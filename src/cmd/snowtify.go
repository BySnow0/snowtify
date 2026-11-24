package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-ini/ini"
	"github.com/spicetify/cli/src/utils"
)

const (
	snowtifyFrostBootstrap = "snowtify-frost.js"
	snowtifyCustomApp      = "snowtify"
	snowtifyAppMarker      = ".snowtify-app-v1"
	snowtifyAppRemoved     = ".snowtify-app-removed-v1"
)

// RemoveSnowtifyApp cleans up the retired control center from snow.5 without
// changing Marketplace or any other custom app.
func RemoveSnowtifyApp() (bool, error) {
	removedMarkerPath := filepath.Join(spicetifyFolder, snowtifyAppRemoved)
	if _, err := os.Stat(removedMarkerPath); err == nil {
		return false, nil
	} else if !os.IsNotExist(err) {
		return false, fmt.Errorf("failed to inspect Snowtify app cleanup state: %w", err)
	}

	changed := removeConfigListValue(featureSection, "custom_apps", snowtifyCustomApp)
	if changed {
		if err := cfg.Write(); err != nil {
			return false, fmt.Errorf("failed to remove retired Snowtify app: %w", err)
		}
	}

	legacyMarkerPath := filepath.Join(spicetifyFolder, snowtifyAppMarker)
	if err := os.WriteFile(legacyMarkerPath, []byte("Snowtify control center retired\n"), 0600); err != nil {
		return changed, fmt.Errorf("failed to save Snowtify legacy app state: %w", err)
	}
	if err := os.WriteFile(removedMarkerPath, []byte("Snowtify control center cleanup completed\n"), 0600); err != nil {
		return changed, fmt.Errorf("failed to save Snowtify app cleanup state: %w", err)
	}

	if changed {
		utils.PrintSuccess("Removed retired Snowtify control center")
	}
	return changed, nil
}

func removeConfigListValue(section *ini.Section, keyName, value string) bool {
	values := section.Key(keyName).Strings("|")
	cleanValues := make([]string, 0, len(values))
	removed := false
	for _, item := range values {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if strings.EqualFold(item, value) {
			removed = true
			continue
		}
		cleanValues = append(cleanValues, item)
	}
	if !removed {
		return false
	}

	section.Key(keyName).SetValue(strings.Join(cleanValues, "|"))
	return true
}

// MigrateSnowtifyFrost removes the retired Frost bootstrap extension, which
// used to make Frost the active theme automatically. Snowtify no longer picks
// a theme for the user; Frost stays available in Marketplace like any other.
func MigrateSnowtifyFrost() (bool, error) {
	if !removeSnowtifyFrostBootstrap(featureSection) {
		return false, nil
	}
	if err := cfg.Write(); err != nil {
		return false, fmt.Errorf("failed to remove the Snowtify Frost bootstrap: %w", err)
	}
	return true, nil
}

func directoryExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func removeSnowtifyFrostBootstrap(features *ini.Section) bool {
	extensions := features.Key("extensions").Strings("|")
	kept := make([]string, 0, len(extensions))
	removed := false
	for _, extension := range extensions {
		extension = strings.TrimSpace(extension)
		if extension == "" {
			continue
		}
		if strings.EqualFold(extension, snowtifyFrostBootstrap) {
			removed = true
			continue
		}
		kept = append(kept, extension)
	}
	if removed {
		features.Key("extensions").SetValue(strings.Join(kept, "|"))
	}
	return removed
}