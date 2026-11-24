package cmd

import (
	"testing"

	"github.com/go-ini/ini"
)

func newFrostTestSections(t *testing.T) (*ini.Section, *ini.Section) {
	t.Helper()
	config := ini.Empty()
	settings, err := config.NewSection("Setting")
	if err != nil {
		t.Fatal(err)
	}
	features, err := config.NewSection("AdditionalOptions")
	if err != nil {
		t.Fatal(err)
	}
	return settings, features
}

func assertConfigValue(t *testing.T, section *ini.Section, key, expected string) {
	t.Helper()
	if actual := section.Key(key).String(); actual != expected {
		t.Fatalf("%s = %q, want %q", key, actual, expected)
	}
}

func TestRemoveSnowtifyFrostBootstrap(t *testing.T) {
	settings, features := newFrostTestSections(t)

	settings.Key("current_theme").SetValue("marketplace")
	features.Key("extensions").SetValue("existing.js|snowtify-frost.js|other.js")

	if !removeSnowtifyFrostBootstrap(features) {
		t.Fatal("expected the Frost bootstrap to be removed")
	}
	assertConfigValue(t, features, "extensions", "existing.js|other.js")
	assertConfigValue(t, settings, "current_theme", "marketplace")
}

func TestRemoveSnowtifyFrostBootstrapLeavesConfigAlone(t *testing.T) {
	_, features := newFrostTestSections(t)
	features.Key("extensions").SetValue("another.js")

	if removeSnowtifyFrostBootstrap(features) {
		t.Fatal("expected no change without the Frost bootstrap")
	}
	assertConfigValue(t, features, "extensions", "another.js")
}

func TestRemoveConfigListValueRemovesSnowtifyOnly(t *testing.T) {
	_, features := newFrostTestSections(t)
	features.Key("custom_apps").SetValue("marketplace|snowtify|reddit")

	if !removeConfigListValue(features, "custom_apps", "snowtify") {
		t.Fatal("expected Snowtify custom app to be removed")
	}
	assertConfigValue(t, features, "custom_apps", "marketplace|reddit")
}

func TestRemoveConfigListValueMatchesCase(t *testing.T) {
	_, features := newFrostTestSections(t)
	features.Key("custom_apps").SetValue("marketplace|Snowtify")

	if !removeConfigListValue(features, "custom_apps", "snowtify") {
		t.Fatal("expected Snowtify custom app to be removed case-insensitively")
	}
	assertConfigValue(t, features, "custom_apps", "marketplace")
}

func TestRemoveConfigListValueLeavesOtherAppsAlone(t *testing.T) {
	_, features := newFrostTestSections(t)
	features.Key("custom_apps").SetValue("marketplace|reddit")

	if removeConfigListValue(features, "custom_apps", "snowtify") {
		t.Fatal("expected unrelated custom apps to remain unchanged")
	}
	assertConfigValue(t, features, "custom_apps", "marketplace|reddit")
}
