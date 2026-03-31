package main

/*
#cgo pkg-config: gtk+-3.0 gtk-layer-shell-0 gstreamer-1.0

#include <gtk/gtk.h>
#include <gtk-layer-shell.h>
#include <gst/gst.h>
#include <stdlib.h>

static GstElement *pipeline = NULL;
static GtkWindow *window = NULL;

// Tear down pipeline + window inside the running main loop so the
// Wayland compositor receives the surface-destroy before the loop exits.
static gboolean cleanup_and_quit(gpointer data) {
	if (pipeline) {
		gst_element_set_state(pipeline, GST_STATE_NULL);
		gst_object_unref(pipeline);
		pipeline = NULL;
	}
	if (window) {
		gtk_widget_destroy(GTK_WIDGET(window));
		window = NULL;
	}
	gtk_main_quit();
	return FALSE;
}

// Thread-safe: can be called from a Go goroutine.
static void request_shutdown(void) {
	g_idle_add(cleanup_and_quit, NULL);
}

static gboolean bus_callback(GstBus *bus, GstMessage *msg, gpointer data) {
	switch (GST_MESSAGE_TYPE(msg)) {
	case GST_MESSAGE_EOS:
		// Loop: seek back to start
		gst_element_seek_simple(pipeline, GST_FORMAT_TIME,
			GST_SEEK_FLAG_FLUSH | GST_SEEK_FLAG_KEY_UNIT, 0);
		break;
	case GST_MESSAGE_ERROR: {
		GError *err = NULL;
		gst_message_parse_error(msg, &err, NULL);
		g_printerr("aether-wp: %s\n", err->message);
		g_error_free(err);
		cleanup_and_quit(NULL);
		break;
	}
	default:
		break;
	}
	return TRUE;
}

static void init_layer_window(void) {
	window = GTK_WINDOW(gtk_window_new(GTK_WINDOW_TOPLEVEL));
	gtk_window_set_decorated(window, FALSE);
	gtk_layer_init_for_window(window);
	gtk_layer_set_layer(window, GTK_LAYER_SHELL_LAYER_BACKGROUND);
	gtk_layer_set_anchor(window, GTK_LAYER_SHELL_EDGE_TOP, TRUE);
	gtk_layer_set_anchor(window, GTK_LAYER_SHELL_EDGE_BOTTOM, TRUE);
	gtk_layer_set_anchor(window, GTK_LAYER_SHELL_EDGE_LEFT, TRUE);
	gtk_layer_set_anchor(window, GTK_LAYER_SHELL_EDGE_RIGHT, TRUE);
	gtk_layer_set_exclusive_zone(window, -1);
}

static int run_gif(const char *path) {
	int argc = 0;
	gtk_init(&argc, NULL);

	init_layer_window();

	// GdkPixbufAnimation is fully deprecated in gdk-pixbuf 2.44+ with no
	// GTK3-compatible replacement.  Suppress the warning until a GTK4 port.
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
	GdkPixbufAnimation *anim = gdk_pixbuf_animation_new_from_file(path, NULL);
#pragma GCC diagnostic pop
	if (!anim) {
		g_printerr("aether-wp: failed to load GIF: %s\n", path);
		return 1;
	}

	GtkWidget *image = gtk_image_new_from_animation(anim);
	g_object_unref(anim);
	gtk_container_add(GTK_CONTAINER(window), image);

	g_signal_connect(window, "destroy", G_CALLBACK(gtk_main_quit), NULL);
	gtk_widget_show_all(GTK_WIDGET(window));
	gtk_main();

	return 0;
}

static int run_wallpaper(const char *path, int force_cpu) {
	int argc = 0;
	gtk_init(&argc, NULL);
	gst_init(&argc, NULL);

	init_layer_window();

	// GStreamer pipeline: playbin + gtkglsink (GPU-accelerated)
	pipeline = gst_element_factory_make("playbin", "player");
	if (!pipeline) {
		g_printerr("aether-wp: failed to create playbin\n");
		return 1;
	}

	// Select video sink: try GPU-accelerated gtkglsink, fall back to CPU gtksink
	GstElement *sink = NULL;
	GstElement *video_sink = NULL;
	int using_gpu = 0;

	if (!force_cpu) {
		sink = gst_element_factory_make("gtkglsink", "sink");
		if (sink) {
			video_sink = gst_element_factory_make("glsinkbin", "glbin");
			if (video_sink) {
				g_object_set(video_sink, "sink", sink, NULL);
				using_gpu = 1;
			} else {
				gst_object_unref(sink);
				sink = NULL;
			}
		}
	}

	// CPU fallback
	if (!sink) {
		sink = gst_element_factory_make("gtksink", "sink");
		if (sink) {
			video_sink = GST_ELEMENT(gst_object_ref(sink));
		}
	}
	if (!sink) {
		g_printerr("aether-wp: no GTK video sink available (install gst-plugins-good or gst-plugin-gtk)\n");
		gst_object_unref(pipeline);
		return 1;
	}

	g_printerr("aether-wp: using %s rendering\n", using_gpu ? "GPU" : "CPU");

	g_object_set(pipeline, "video-sink", video_sink, NULL);
	g_object_set(pipeline, "volume", 0.0, NULL);

	// Flags: video + native-video + deinterlace, no audio.
	// native-video is required for 10-bit H.264/AV1 (only hardware decoders support it).
	g_object_set(pipeline, "flags", 0x61, NULL);

	// Get the GTK widget from the sink and add to window
	GtkWidget *video_widget = NULL;
	g_object_get(sink, "widget", &video_widget, NULL);
	if (!video_widget) {
		g_printerr("aether-wp: failed to get video widget\n");
		gst_object_unref(pipeline);
		return 1;
	}
	gtk_container_add(GTK_CONTAINER(window), video_widget);
	g_object_unref(video_widget);

	// Set URI and start playback
	gchar *uri = gst_filename_to_uri(path, NULL);
	if (!uri) {
		g_printerr("aether-wp: invalid file path: %s\n", path);
		gst_object_unref(pipeline);
		return 1;
	}
	g_object_set(pipeline, "uri", uri, NULL);
	g_free(uri);

	// Watch for EOS (loop) and errors
	GstBus *bus = gst_element_get_bus(pipeline);
	gst_bus_add_watch(bus, bus_callback, NULL);
	gst_object_unref(bus);

	gst_element_set_state(pipeline, GST_STATE_PLAYING);

	g_signal_connect(window, "destroy", G_CALLBACK(gtk_main_quit), NULL);
	gtk_widget_show_all(GTK_WIDGET(window));
	gtk_main();

	return 0;
}
*/
import "C"

import (
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

func pidFilePath() string {
	if dir := os.Getenv("XDG_RUNTIME_DIR"); dir != "" {
		return filepath.Join(dir, "aether-wp.pid")
	}
	return "/tmp/aether-wp.pid"
}

func writePidFile() {
	_ = os.WriteFile(pidFilePath(), []byte(strconv.Itoa(os.Getpid())), 0644)
}

func removePidFile() {
	_ = os.Remove(pidFilePath())
}

func isProcessAlive(pid int) bool {
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	return proc.Signal(syscall.Signal(0)) == nil
}

// stopViaPidFile sends SIGTERM to the process in the PID file and waits for it to exit.
func stopViaPidFile() bool {
	data, err := os.ReadFile(pidFilePath())
	if err != nil {
		return false
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		removePidFile()
		return false
	}
	proc, err := os.FindProcess(pid)
	if err != nil {
		removePidFile()
		return false
	}
	if proc.Signal(syscall.SIGTERM) != nil {
		removePidFile()
		return false
	}
	// Wait up to 2 seconds for graceful shutdown
	for i := 0; i < 20; i++ {
		time.Sleep(100 * time.Millisecond)
		if !isProcessAlive(pid) {
			removePidFile()
			return true
		}
	}
	// Force kill if still alive
	_ = proc.Signal(syscall.SIGKILL)
	removePidFile()
	return true
}

// stopAll stops any running instance using PID file first, then pkill as fallback.
// Only safe to call from --stop (not from a new instance, since pkill would kill itself).
func stopAll() {
	if !stopViaPidFile() {
		_ = exec.Command("pkill", "-x", "aether-wp").Run()
	}
	fmt.Fprintln(os.Stderr, "aether-wp: stopped")
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: aether-wp [--cpu] <media-file>")
		fmt.Fprintln(os.Stderr, "       aether-wp --stop")
		os.Exit(1)
	}

	if os.Args[1] == "--stop" {
		stopAll()
		os.Exit(0)
	}

	forceCPU := false
	path := os.Args[1]
	if path == "--cpu" {
		forceCPU = true
		if len(os.Args) < 3 {
			fmt.Fprintln(os.Stderr, "Usage: aether-wp [--cpu] <media-file>")
			os.Exit(1)
		}
		path = os.Args[2]
	}

	if _, err := os.Stat(path); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "aether-wp: file not found: %s\n", path)
		os.Exit(1)
	}

	// Stop any previous instance via PID file (pkill not safe here — would kill us)
	stopViaPidFile()
	writePidFile()

	// Clean shutdown on SIGTERM/SIGINT
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-sig
		C.request_shutdown()
	}()

	cpath := C.CString(path)
	defer C.free(unsafe.Pointer(cpath))

	var rc C.int
	if strings.ToLower(filepath.Ext(path)) == ".gif" {
		rc = C.run_gif(cpath)
	} else {
		cpu := C.int(0)
		if forceCPU {
			cpu = 1
		}
		rc = C.run_wallpaper(cpath, cpu)
	}
	removePidFile()
	os.Exit(int(rc))
}
