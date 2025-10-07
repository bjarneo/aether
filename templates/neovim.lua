return {
	{
		"bjarneo/aether.nvim",
		name = "aether",
		priority = 1000,
		opts = {
			disable_italics = false,
			colors = {
				-- Monotone shades (base00-base07)
				base00 = "{background}", -- Default background
				base01 = "{color8}", -- Lighter background (status bars)
				base02 = "{color0}", -- Selection background
				base03 = "{color8}", -- Comments, invisibles
				base04 = "{color7}", -- Dark foreground
				base05 = "{foreground}", -- Default foreground
				base06 = "{color15}", -- Light foreground
				base07 = "{color7}", -- Light background

				-- Accent colors (base08-base0F)
				base08 = "{color1}", -- Variables, errors, red
				base09 = "{color9}", -- Integers, constants, orange
				base0A = "{color3}", -- Classes, types, yellow
				base0B = "{color2}", -- Strings, green
				base0C = "{color6}", -- Support, regex, cyan
				base0D = "{color4}", -- Functions, keywords, blue
				base0E = "{color5}", -- Keywords, storage, magenta
				base0F = "{color11}", -- Deprecated, brown/yellow
			},
		},
	},
	{
		"LazyVim/LazyVim",
		opts = {
			colorscheme = "aether",
		},
	},
}
