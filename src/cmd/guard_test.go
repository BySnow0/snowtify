package cmd

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIsNewerSnowtify(t *testing.T) {
	cases := []struct {
		candidate, current string
		want               bool
	}{
		{"2.46.7-snow.2", "2.46.7-snow.1", true},
		{"2.47.0-snow.1", "2.46.7-snow.9", true},
		{"v2.46.10-snow.1", "2.46.9-snow.3", true},
		{"2.46.7-snow.1", "2.46.7-snow.1", false},
		{"2.46.6-snow.4", "2.46.7-snow.1", false},
		{"2.46.7", "2.46.7-snow.1", false},
	}
	for _, c := range cases {
		if got := isNewerSnowtify(c.candidate, c.current); got != c.want {
			t.Errorf("isNewerSnowtify(%q, %q) = %v, want %v", c.candidate, c.current, got, c.want)
		}
	}
}

func TestStripANSI(t *testing.T) {
	if got := stripANSI("\x1b[32mSuccess\x1b[0m done"); got != "Success done" {
		t.Errorf("stripANSI = %q", got)
	}
}

func TestGuardRejectsForeignOrigins(t *testing.T) {
	g := &guard{version: "2.46.7-snow.1", status: GuardStatus{Phase: "idle"}}
	handler := g.routes()

	cases := []struct {
		method, path, origin string
		want                 int
	}{
		{http.MethodPost, "/update", "https://evil.example", http.StatusForbidden},
		{http.MethodPost, "/shutdown", "https://xpui.app.spotify.com", http.StatusForbidden},
		{http.MethodPost, "/update", "https://xpui.app.spotify.com", http.StatusConflict}, // no update available
		{http.MethodOptions, "/update", "https://xpui.app.spotify.com", http.StatusNoContent},
	}
	for _, c := range cases {
		request := httptest.NewRequest(c.method, c.path, nil)
		if c.origin != "" {
			request.Header.Set("Origin", c.origin)
		}
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, request)
		if recorder.Code != c.want {
			t.Errorf("%s %s from %q = %d, want %d", c.method, c.path, c.origin, recorder.Code, c.want)
		}
	}
}
