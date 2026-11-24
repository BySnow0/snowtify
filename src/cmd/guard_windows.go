//go:build windows

package cmd

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/spicetify/cli/src/utils"
	"golang.org/x/sys/windows/registry"
)

const (
	guardRunKey       = `Software\Microsoft\Windows\CurrentVersion\Run`
	guardRunValue     = "SnowtifyGuard"
	createNoWindow    = 0x08000000
	detachedProcess   = 0x00000008
	createNewProcGrp  = 0x00000200
	guardStartupFlags = detachedProcess | createNewProcGrp
)

func conhostPath() string {
	return filepath.Join(os.Getenv("SystemRoot"), "System32", "conhost.exe")
}

// guardCommandLine runs the guard inside a headless console host so no window
// ever appears, at logon or after an update.
func guardCommandLine(exe string) []string {
	return []string{conhostPath(), "--headless", exe, "guard", "run"}
}

func hideChildWindow(command *exec.Cmd) {
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
}

func startGuardDetached(exe string) error {
	args := guardCommandLine(exe)
	command := exec.Command(args[0], args[1:]...)
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: guardStartupFlags}
	if err := command.Start(); err != nil {
		return err
	}
	return command.Process.Release()
}

func isSpotifyRunning() bool {
	output, err := exec.Command("tasklist", "/FI", "IMAGENAME eq Spotify.exe", "/NH").Output()
	return err == nil && strings.Contains(strings.ToLower(string(output)), "spotify.exe")
}

// InstallGuard registers the guard to start at logon and starts it now.
func InstallGuard() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}

	key, _, err := registry.CreateKey(registry.CURRENT_USER, guardRunKey, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer key.Close()

	args := guardCommandLine(exe)
	quoted := make([]string, len(args))
	for i, arg := range args {
		if strings.ContainsAny(arg, " \t") {
			arg = `"` + arg + `"`
		}
		quoted[i] = arg
	}
	if err := key.SetStringValue(guardRunValue, strings.Join(quoted, " ")); err != nil {
		return err
	}

	if _, err := GuardStatusRemote(); err == nil {
		_ = StopGuard() // restart so the running guard uses this binary
	}
	if err := startGuardDetached(exe); err != nil {
		return err
	}
	utils.PrintSuccess("Snowtify guard enabled: it starts with Windows, repairs Snowtify after Spotify updates and installs Snowtify updates.")
	return nil
}

// UninstallGuard stops the guard and removes it from logon.
func UninstallGuard() error {
	_ = StopGuard()
	key, err := registry.OpenKey(registry.CURRENT_USER, guardRunKey, registry.SET_VALUE)
	if err == nil {
		defer key.Close()
		if err := key.DeleteValue(guardRunValue); err != nil && err != registry.ErrNotExist {
			return err
		}
	}
	utils.PrintSuccess("Snowtify guard disabled.")
	return nil
}
