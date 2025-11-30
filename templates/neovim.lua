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
                base01 = "{bright_black}", -- Lighter background (status bars)
                base02 = "{black}", -- Selection background
                base03 = "{bright_black}", -- Comments, invisibles
                base04 = "{white}", -- Dark foreground
                base05 = "{foreground}", -- Default foreground
                base06 = "{bright_white}", -- Light foreground
                base07 = "{white}", -- Light background

                -- Accent colors (base08-base0F)
                base08 = "{red}", -- Variables, errors, red
                base09 = "{bright_red}", -- Integers, constants, orange
                base0A = "{yellow}", -- Classes, types, yellow
                base0B = "{green}", -- Strings, green
                base0C = "{cyan}", -- Support, regex, cyan
                base0D = "{blue}", -- Functions, keywords, blue
                base0E = "{magenta}", -- Keywords, storage, magenta
                base0F = "{bright_yellow}", -- Deprecated, brown/yellow
            },
        },
        config = function(_, opts)
            require("aether").setup(opts)
            vim.cmd.colorscheme("aether")

            -- Enable hot reload
            require("aether.hotreload").setup()
        end,
    },
    {
        "LazyVim/LazyVim",
        opts = {
            colorscheme = "aether",
        },
    },
}
