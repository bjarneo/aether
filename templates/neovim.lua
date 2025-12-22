return {
    {
        -- "bjarneo/aether.nvim",
        -- branch = "v2",
        dir = "~/Code/aether.nvim/",
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
                -- fg: Object properties, builtin types, builtin variables, member access, default text
                fg = "{foreground}",
                -- fg_dark: Inactive elements, statusline, secondary text
                fg_dark = "{white}",
                -- comment: Line highlight, gutter elements, disabled states
                comment = "{bright_black}",

                -- Accent colors
                -- red: Errors, diagnostics, tags, deletions, breakpoints
                red = "{red}",
                -- orange: Constants, numbers, current line number, git modifications
                orange = "{bright_red}",
                -- yellow: Types, classes, constructors, warnings, numbers, booleans
                yellow = "{yellow}",
                -- green: Comments, strings, success states, git additions
                green = "{green}",
                -- cyan: Parameters, regex, preprocessor, hints, properties
                cyan = "{cyan}",
                -- blue: Functions, keywords, directories, links, info diagnostics
                blue = "{blue}",
                -- purple: Storage keywords, special keywords, identifiers, namespaces
                purple = "{magenta}",
                -- magenta: Function declarations, exception handling, tags
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
