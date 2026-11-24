package cmd

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/spicetify/cli/src/utils"
)

// The guard is a small background process that keeps Snowtify healthy:
//   - when Spotify updates itself and drops the customization, it reapplies it;
//   - when reapplying fails, it restores stock Spotify so Spotify always works,
//     and retries once a newer Snowtify is available;
//   - it serves a localhost API that the Spotify UI uses to install Snowtify
//     updates in place (with the update animation) instead of asking the user
//     to run a command.

// GuardPort is the localhost port the guard listens on.
const GuardPort = 47823

const (
	guardTick           = 15 * time.Second
	guardUpdateInterval = 6 * time.Hour
	guardStatusRefresh  = 15 * time.Minute
	guardCommandTimeout = 10 * time.Minute
	guardEnvMarker      = "SNOWTIFY_GUARD"
	nonInteractiveEnv   = "SNOWTIFY_NONINTERACTIVE"
)

// Origins allowed to drive the guard from a browser context. Requests from
// other web pages are rejected; requests without an Origin come from local
// programs (the CLI itself), which can already run Snowtify directly.
var guardAllowedOrigins = map[string]bool{
	"https://xpui.app.spotify.com": true,
}

type guardPersisted struct {
	Desired        string `json:"desired"` // "applied" or "stock"
	FailedSpotify  string `json:"failedSpotify,omitempty"`
	FailedSnowtify string `json:"failedSnowtify,omitempty"`
}

// GuardStatus is what /status returns.
type GuardStatus struct {
	Version         string `json:"version"`
	Latest          string `json:"latest,omitempty"`
	UpdateAvailable bool   `json:"updateAvailable"`
	Phase           string `json:"phase"` // idle, updating, repairing, error
	Step            string `json:"step,omitempty"`
	Message         string `json:"message,omitempty"`
}

type guard struct {
	version string
	exe     string

	mu          sync.Mutex
	status      GuardStatus
	busy        bool
	lastCheck   time.Time
	pendingHeal string // Spotify version seen needing repair on the previous tick
	listener    net.Listener
}

func guardStatePath() string {
	return filepath.Join(utils.GetStateFolder("Guard"), "snowtify-guard.json")
}

func readGuardState() guardPersisted {
	var state guardPersisted
	if content, err := os.ReadFile(guardStatePath()); err == nil {
		_ = json.Unmarshal(content, &state)
	}
	return state
}

func writeGuardState(state guardPersisted) {
	content, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(guardStatePath(), content, 0600)
}

// SetGuardDesired records whether the user wants Snowtify applied. It is
// called after a user-run apply or restore; the guard's own commands are
// ignored so a fallback restore does not turn auto-repair off.
func SetGuardDesired(applied bool) {
	if os.Getenv(guardEnvMarker) == "1" {
		return
	}
	state := readGuardState()
	if applied {
		state.Desired = "applied"
		state.FailedSpotify, state.FailedSnowtify = "", ""
	} else {
		state.Desired = "stock"
	}
	writeGuardState(state)
}

func isNonInteractive() bool {
	return os.Getenv(nonInteractiveEnv) == "1"
}

// RunGuard runs the guard in the foreground until the process is stopped.
func RunGuard(version string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	exe = strings.TrimSuffix(exe, ".old")

	// The port doubles as a single-instance lock. Retry for a while so a
	// guard relaunched after an update can take over from the old one.
	var listener net.Listener
	for deadline := time.Now().Add(20 * time.Second); ; {
		listener, err = net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(GuardPort))
		if err == nil {
			break
		}
		if time.Now().After(deadline) {
			return errors.New("the Snowtify guard is already running")
		}
		time.Sleep(time.Second)
	}

	g := &guard{
		version:  version,
		exe:      exe,
		listener: listener,
		status:   GuardStatus{Version: version, Phase: "idle"},
	}

	state := readGuardState()
	if state.Desired == "" {
		state.Desired = "stock"
		if backupSection.Key("version").MustString("") != "" {
			state.Desired = "applied"
		}
		writeGuardState(state)
	}

	g.log("Guard started (Snowtify " + version + ", desired: " + state.Desired + ")")

	server := &http.Server{Handler: g.routes(), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) && !errors.Is(err, net.ErrClosed) {
			g.log("HTTP server stopped: " + err.Error())
		}
	}()

	go func() {
		time.Sleep(30 * time.Second)
		for {
			g.checkLatest()
			time.Sleep(guardUpdateInterval)
		}
	}()

	ticker := time.NewTicker(guardTick)
	defer ticker.Stop()
	for range ticker.C {
		g.tick()
	}
	return nil
}

func (g *guard) log(line string) {
	_ = appendSnowtifyLog("guard", []string{line})
}

func (g *guard) snapshot() GuardStatus {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.status
}

func (g *guard) setPhase(phase, step, message string) {
	g.mu.Lock()
	g.status.Phase, g.status.Step, g.status.Message = phase, step, message
	g.mu.Unlock()
}

func (g *guard) tryBusy() bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.busy {
		return false
	}
	g.busy = true
	return true
}

func (g *guard) release() {
	g.mu.Lock()
	g.busy = false
	g.mu.Unlock()
}

func (g *guard) checkLatest() {
	latest, err := utils.FetchLatestTag()
	g.mu.Lock()
	g.lastCheck = time.Now()
	if err == nil && latest != "" {
		g.status.Latest = latest
		g.status.UpdateAvailable = g.version != "Dev" && isNewerSnowtify(latest, g.version)
	}
	g.mu.Unlock()
}

// tick is the cheap periodic health check: one directory listing and one
// small file read. Anything heavier only runs when something is wrong.
func (g *guard) tick() {
	g.mu.Lock()
	busy := g.busy
	g.mu.Unlock()
	if busy {
		return
	}

	filesState, err := inspectSpotifyFiles(appDestPath)
	if err != nil {
		return
	}
	spotifyVersion, _ := readSpotifyVersion(prefsPath)
	state := readGuardState()

	needsRepair := state.Desired == "applied" &&
		(filesState == spotifyFilesStock || filesState == spotifyFilesMixed)
	if !needsRepair {
		g.pendingHeal = ""
		status := g.snapshot()
		if status.UpdateAvailable && !isSpotifyRunning() && state.FailedSnowtify != status.Latest {
			g.runUpdate(false)
		}
		return
	}

	if state.FailedSpotify == spotifyVersion && state.FailedSnowtify == g.version {
		return // already failed for this exact pair; wait for a newer Snowtify
	}

	// Act only when the same state is seen twice in a row, so a Spotify
	// update that is still writing files is left to finish first.
	if g.pendingHeal != spotifyVersion {
		g.pendingHeal = spotifyVersion
		return
	}
	g.pendingHeal = ""
	g.heal(spotifyVersion)
}

// heal reapplies Snowtify after Spotify dropped it. If that fails it restores
// stock Spotify so the client keeps working.
func (g *guard) heal(spotifyVersion string) {
	if !g.tryBusy() {
		return
	}
	defer g.release()

	g.log("Spotify " + spotifyVersion + " is missing the Snowtify customization; repairing")
	g.setPhase("repairing", "applying", "")

	g.checkLatest()
	updated := false
	var err error
	if g.snapshot().UpdateAvailable {
		// A newer Snowtify likely supports this Spotify version; update
		// installs it and reapplies the customization in one go.
		err = g.runSnowtify("update")
		updated = err == nil
	} else {
		err = g.runSnowtify("repair")
	}

	if filesState, inspectErr := inspectSpotifyFiles(appDestPath); err == nil && inspectErr == nil && filesState == spotifyFilesApplied {
		g.log("Repair completed for Spotify " + spotifyVersion)
		g.setPhase("idle", "", "")
		if updated {
			g.relaunch()
		}
		return
	}

	reason := "customization was not applied"
	if err != nil {
		reason = err.Error()
	}
	g.log("Repair failed (" + reason + "); restoring stock Spotify so it keeps working")
	_ = g.runSnowtify("restore")

	state := readGuardState()
	state.FailedSpotify, state.FailedSnowtify = spotifyVersion, g.version
	writeGuardState(state)
	g.setPhase("error", "", "Snowtify could not be applied to Spotify "+spotifyVersion+". Spotify was restored and Snowtify will retry when an update is available.")
	if updated {
		g.relaunch()
	}
}

// runUpdate installs the latest Snowtify release. restartSpotify is true when
// the Spotify UI asked for it; silent background updates leave Spotify closed.
func (g *guard) runUpdate(restartSpotify bool) {
	if !g.tryBusy() {
		return
	}
	defer g.release()

	g.log("Updating Snowtify " + g.version + " -> " + g.snapshot().Latest)
	g.setPhase("updating", "downloading", "")

	args := []string{"update"}
	if !restartSpotify {
		args = append([]string{"-n"}, args...)
	}
	if err := g.runSnowtify(args...); err != nil {
		g.log("Update failed: " + err.Error())
		state := readGuardState()
		state.FailedSnowtify = g.snapshot().Latest
		writeGuardState(state)
		g.setPhase("error", "", "The update could not be installed. Your current setup was kept.")
		return
	}
	g.log("Update installed")
	g.setPhase("updating", "restarting", "")
	g.relaunch()
}

// runSnowtify runs the Snowtify CLI non-interactively and turns its output
// into progress steps for the Spotify UI.
func (g *guard) runSnowtify(args ...string) error {
	ctx, cancel := context.WithTimeout(context.Background(), guardCommandTimeout)
	defer cancel()

	command := exec.CommandContext(ctx, g.exe, args...)
	command.Env = append(os.Environ(), guardEnvMarker+"=1", nonInteractiveEnv+"=1")
	hideChildWindow(command)
	output, err := command.StdoutPipe()
	if err != nil {
		return err
	}
	command.Stderr = command.Stdout

	if err := command.Start(); err != nil {
		return err
	}

	var lines []string
	scanner := bufio.NewScanner(output)
	for scanner.Scan() {
		line := strings.TrimSpace(stripANSI(scanner.Text()))
		if line == "" {
			continue
		}
		lines = append(lines, line)
		lower := strings.ToLower(line)
		switch {
		case strings.Contains(lower, "download"):
			g.setPhaseStep("downloading")
		case strings.Contains(lower, "backup"), strings.Contains(lower, "appl"), strings.Contains(lower, "successfully updated"):
			g.setPhaseStep("applying")
		case strings.Contains(lower, "restart"), strings.Contains(lower, "launch"):
			g.setPhaseStep("restarting")
		}
	}
	err = command.Wait()
	_ = appendSnowtifyLog("guard "+strings.Join(args, " "), lines)
	if err != nil {
		return fmt.Errorf("snowtify %s: %w", strings.Join(args, " "), err)
	}
	return nil
}

func (g *guard) setPhaseStep(step string) {
	g.mu.Lock()
	g.status.Step = step
	g.mu.Unlock()
}

// relaunch starts the (possibly updated) guard binary and exits this one.
func (g *guard) relaunch() {
	g.log("Restarting the guard")
	_ = g.listener.Close()
	if err := startGuardDetached(g.exe); err != nil {
		g.log("Could not relaunch the guard: " + err.Error())
		return
	}
	os.Exit(0)
}

func (g *guard) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		if !g.allow(w, r) {
			return
		}
		g.mu.Lock()
		stale := time.Since(g.lastCheck) > guardStatusRefresh && !g.busy
		g.mu.Unlock()
		if stale {
			g.checkLatest()
		}
		writeJSON(w, g.snapshot())
	})
	mux.HandleFunc("/update", func(w http.ResponseWriter, r *http.Request) {
		if !g.allow(w, r) {
			return
		}
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		status := g.snapshot()
		if !status.UpdateAvailable && status.Phase != "updating" {
			w.WriteHeader(http.StatusConflict)
			writeJSON(w, status)
			return
		}
		go g.runUpdate(true)
		w.WriteHeader(http.StatusAccepted)
		writeJSON(w, g.snapshot())
	})
	mux.HandleFunc("/shutdown", func(w http.ResponseWriter, r *http.Request) {
		// Only local programs (no Origin header), never web pages.
		if r.Method != http.MethodPost || r.Header.Get("Origin") != "" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		go func() {
			time.Sleep(200 * time.Millisecond)
			os.Exit(0)
		}()
	})
	return mux
}

func (g *guard) allow(w http.ResponseWriter, r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin != "" {
		if !guardAllowedOrigins[origin] {
			w.WriteHeader(http.StatusForbidden)
			return false
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST")
		w.Header().Set("Access-Control-Allow-Private-Network", "true")
		w.Header().Set("Vary", "Origin")
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(value)
}

// GuardStatusRemote asks a running guard for its status.
func GuardStatusRemote() (GuardStatus, error) {
	var status GuardStatus
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + strconv.Itoa(GuardPort) + "/status")
	if err != nil {
		return status, err
	}
	defer resp.Body.Close()
	err = json.NewDecoder(resp.Body).Decode(&status)
	return status, err
}

// StopGuard asks a running guard to exit.
func StopGuard() error {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Post("http://127.0.0.1:"+strconv.Itoa(GuardPort)+"/shutdown", "text/plain", nil)
	if err != nil {
		return err
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.Body.Close()
}

// ShowGuardStatus prints the guard state for `snowtify guard status`.
func ShowGuardStatus() bool {
	utils.PrintBold("Snowtify guard")
	status, err := GuardStatusRemote()
	if err != nil {
		utils.PrintWarning(`The guard is not running. Run "snowtify guard install" to enable automatic repair and updates.`)
		return false
	}
	utils.PrintSuccess("Running (Snowtify " + status.Version + ")")
	if status.UpdateAvailable {
		utils.PrintInfo("Update available: " + status.Latest)
	}
	utils.PrintInfo("Phase: " + status.Phase)
	if status.Message != "" {
		utils.PrintInfo(status.Message)
	}
	state := readGuardState()
	if state.Desired == "stock" {
		utils.PrintInfo(`Auto-repair is paused because Snowtify was restored. Run "snowtify apply" to resume it.`)
	}
	return true
}

func stripANSI(value string) string {
	var out strings.Builder
	for i := 0; i < len(value); i++ {
		if value[i] == 0x1b && i+1 < len(value) && value[i+1] == '[' {
			i += 2
			for i < len(value) && (value[i] < '@' || value[i] > '~') {
				i++
			}
			continue
		}
		out.WriteByte(value[i])
	}
	return out.String()
}

// isNewerSnowtify compares versions like 2.46.7-snow.2.
func isNewerSnowtify(candidate, current string) bool {
	a, b := snowtifyVersionParts(candidate), snowtifyVersionParts(current)
	for i := range a {
		if a[i] != b[i] {
			return a[i] > b[i]
		}
	}
	return false
}

func snowtifyVersionParts(version string) [4]int {
	var parts [4]int
	version = strings.TrimPrefix(version, "v")
	base, snow, _ := strings.Cut(version, "-snow.")
	for i, field := range strings.SplitN(base, ".", 3) {
		parts[i], _ = strconv.Atoi(field)
	}
	parts[3], _ = strconv.Atoi(snow)
	return parts
}
