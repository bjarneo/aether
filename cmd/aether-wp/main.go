package main

/*
#cgo pkg-config: gtk+-3.0 gtk-layer-shell-0 gstreamer-1.0

#include <gtk/gtk.h>
#include <gtk-layer-shell.h>
#include <gst/gst.h>
#include <stdlib.h>

static GstElement *pipeline = NULL;

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
		gtk_main_quit();
		break;
	}
	default:
		break;
	}
	return TRUE;
}

static int run_wallpaper(const char *path) {
	int argc = 0;
	gtk_init(&argc, NULL);
	gst_init(&argc, NULL);

	// Create window on the background layer
	GtkWindow *window = GTK_WINDOW(gtk_window_new(GTK_WINDOW_TOPLEVEL));
	gtk_window_set_decorated(window, FALSE);
	gtk_layer_init_for_window(window);
	gtk_layer_set_layer(window, GTK_LAYER_SHELL_LAYER_BACKGROUND);
	gtk_layer_set_anchor(window, GTK_LAYER_SHELL_EDGE_TOP, TRUE);
	gtk_layer_set_anchor(window, GTK_LAYER_SHELL_EDGE_BOTTOM, TRUE);
	gtk_layer_set_anchor(window, GTK_LAYER_SHELL_EDGE_LEFT, TRUE);
	gtk_layer_set_anchor(window, GTK_LAYER_SHELL_EDGE_RIGHT, TRUE);
	gtk_layer_set_exclusive_zone(window, -1);

	// GStreamer pipeline: playbin + gtkglsink (GPU-accelerated)
	pipeline = gst_element_factory_make("playbin", "player");
	if (!pipeline) {
		g_printerr("aether-wp: failed to create playbin\n");
		return 1;
	}

	// Try gtkglsink (OpenGL, hardware-accelerated) first, fall back to gtksink (CPU)
	GstElement *sink = gst_element_factory_make("gtkglsink", "sink");
	GstElement *video_sink = NULL;
	if (sink) {
		// Wrap gtkglsink in glsinkbin for proper GL pipeline
		video_sink = gst_element_factory_make("glsinkbin", "glbin");
		if (video_sink) {
			g_object_set(video_sink, "sink", sink, NULL);
		} else {
			gst_object_unref(sink);
			sink = NULL;
		}
	}
	if (!sink) {
		sink = gst_element_factory_make("gtksink", "sink");
		video_sink = GST_ELEMENT(gst_object_ref(sink));
	}
	if (!sink) {
		g_printerr("aether-wp: no GTK video sink available (install gst-plugins-good or gst-plugin-gtk)\n");
		gst_object_unref(pipeline);
		return 1;
	}

	g_object_set(pipeline, "video-sink", video_sink, NULL);
	g_object_set(pipeline, "volume", 0.0, NULL);

	// Enable hardware decoding flags
	g_object_set(pipeline, "flags", 0x63, NULL); // video + audio + native-video + deinterlace

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

	gst_element_set_state(pipeline, GST_STATE_NULL);
	gst_object_unref(pipeline);
	return 0;
}
*/
import "C"

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"unsafe"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: aether-wp <media-file>")
		os.Exit(1)
	}

	path := os.Args[1]
	if _, err := os.Stat(path); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "aether-wp: file not found: %s\n", path)
		os.Exit(1)
	}

	// Clean shutdown on SIGTERM/SIGINT
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-sig
		C.gtk_main_quit()
	}()

	cpath := C.CString(path)
	defer C.free(unsafe.Pointer(cpath))
	rc := C.run_wallpaper(cpath)
	os.Exit(int(rc))
}
