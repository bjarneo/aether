return {
    {
        --"bjarneo/aether.nvim",
        --branch="v2",
        dir = "~/Code/aether.nvim",
        name = "aether",
        priority = 1000,
        opts = {
            transparent = false,
            colors = {
                -- Background colors
                bg = "{background}",
                bg_dark = "{background}",
                bg_highlight = "{bright_black}",

                -- Foreground colors
                fg = "{foreground}",
                fg_dark = "{white}",
                comment = "{bright_black}",

                -- Accent colors
                red = "{red}",
                orange = "{bright_red}",
                yellow = "{yellow}",
                green = "{green}",
                cyan = "{cyan}",
                blue = "{blue}",
                purple = "{magenta}",
                magenta = "{bright_magenta}",
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
