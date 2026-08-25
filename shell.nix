{ pkgs ? import <nixpkgs> { } }:

let
  libPaths = builtins.map (pkg: "${pkg}/lib") (with pkgs; [
    webkitgtk_4_1
    gtk3
    glib
    cairo
    pango
    gdk-pixbuf
    atk
    libsoup_3
    libx11
    libxcomposite
    libxdamage
    libxext
    libxfixes
    libxi
    libxrandr
    libxrender
    libxtst
    libxcb
    libGL
    libxkbcommon
    libepoxy
    freetype
    fontconfig
  ]);
in
pkgs.mkShell {
  buildInputs = with pkgs; [
    webkitgtk_4_1
    gtk3
    glib
    cairo
    pango
    gdk-pixbuf
    atk
    libsoup_3
    libx11
    libxcomposite
    libxdamage
    libxext
    libxfixes
    libxi
    libxrandr
    libxrender
    libxtst
    libxcb
    libGL
    libxkbcommon
    libepoxy
    freetype
    fontconfig
  ];

  shellHook = ''
    export LD_LIBRARY_PATH="${builtins.concatStringsSep ":" libPaths}:$LD_LIBRARY_PATH"
  '';
}
