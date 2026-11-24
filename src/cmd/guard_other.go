//go:build !windows

package cmd

import (
	"errors"
	"os/exec"
)

func hideChildWindow(command *exec.Cmd) {}

func startGuardDetached(exe string) error {
	command := exec.Command(exe, "guard", "run")
	command.Stdin, command.Stdout, command.Stderr = nil, nil, nil
	if err := command.Start(); err != nil {
		return err
	}
	return command.Process.Release()
}

func isSpotifyRunning() bool {
	for _, name := range []string{"spotify", "Spotify"} {
		if exec.Command("pgrep", "-x", name).Run() == nil {
			return true
		}
	}
	return false
}

// InstallGuard is Windows-only for now; elsewhere the guard can be started
// from the session's autostart with "snowtify guard run".
func InstallGuard() error {
	return errors.New(`automatic startup is only available on Windows for now; add "snowtify guard run" to your session autostart instead`)
}

func UninstallGuard() error {
	return StopGuard()
}
