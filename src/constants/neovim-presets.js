/**
 * Popular Neovim color scheme presets in LazyVim format
 */

export const NEOVIM_PRESETS = [
    {
        name: 'Catppuccin',
        author: 'Soothing Pastel',
        config: `return {
\t{
\t\t"catppuccin/nvim",
\t\tname = "catppuccin",
\t\tpriority = 1000,
\t\topts = {
\t\t\tflavour = "mocha",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "catppuccin",
\t\t},
\t},
}`
    },
    {
        name: 'Tokyo Night',
        author: 'Night Coding',
        config: `return {
\t{
\t\t"folke/tokyonight.nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\tstyle = "night",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "tokyonight",
\t\t},
\t},
}`
    },
    {
        name: 'Gruvbox',
        author: 'Retro Groove',
        config: `return {
\t{
\t\t"ellisonleao/gruvbox.nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\tcontrast = "hard",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "gruvbox",
\t\t},
\t},
}`
    },
    {
        name: 'Rose Pine',
        author: 'Rosé Pine',
        config: `return {
\t{
\t\t"rose-pine/neovim",
\t\tname = "rose-pine",
\t\tpriority = 1000,
\t\topts = {
\t\t\tvariant = "main",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "rose-pine",
\t\t},
\t},
}`
    },
    {
        name: 'Nord',
        author: 'Arctic Bluish',
        config: `return {
\t{
\t\t"shaunsingh/nord.nvim",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "nord",
\t\t},
\t},
}`
    },
    {
        name: 'Kanagawa',
        author: 'The Great Wave',
        config: `return {
\t{
\t\t"rebelot/kanagawa.nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\ttheme = "wave",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "kanagawa",
\t\t},
\t},
}`
    },
    {
        name: 'Nightfox',
        author: 'Night Coding',
        config: `return {
\t{
\t\t"EdenEast/nightfox.nvim",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "nightfox",
\t\t},
\t},
}`
    },
    {
        name: 'Dracula',
        author: 'Dracula Theme',
        config: `return {
\t{
\t\t"Mofiqul/dracula.nvim",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "dracula",
\t\t},
\t},
}`
    },
    {
        name: 'One Dark',
        author: 'Atom Inspired',
        config: `return {
\t{
\t\t"navarasu/onedark.nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\tstyle = "dark",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "onedark",
\t\t},
\t},
}`
    },
    {
        name: 'Everforest',
        author: 'Nature Inspired',
        config: `return {
\t{
\t\t"neanias/everforest-nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\tbackground = "hard",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "everforest",
\t\t},
\t},
}`
    },
    {
        name: 'Sonokai',
        author: 'High Contrast',
        config: `return {
\t{
\t\t"sainnhe/sonokai",
\t\tpriority = 1000,
\t\tconfig = function()
\t\t\tvim.g.sonokai_style = "default"
\t\tend,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "sonokai",
\t\t},
\t},
}`
    },
    {
        name: 'Moonfly',
        author: 'Dark Sky',
        config: `return {
\t{
\t\t"bluz71/vim-moonfly-colors",
\t\tname = "moonfly",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "moonfly",
\t\t},
\t},
}`
    },
    {
        name: 'Nightfly',
        author: 'Dark Blue',
        config: `return {
\t{
\t\t"bluz71/vim-nightfly-colors",
\t\tname = "nightfly",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "nightfly",
\t\t},
\t},
}`
    },
    {
        name: 'Material',
        author: 'Material Design',
        config: `return {
\t{
\t\t"marko-cerovac/material.nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\tstyle = "darker",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "material",
\t\t},
\t},
}`
    },
    {
        name: 'Cyberdream',
        author: 'Cyberpunk',
        config: `return {
\t{
\t\t"scottmckendry/cyberdream.nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\ttransparent = false,
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "cyberdream",
\t\t},
\t},
}`
    },
    {
        name: 'Flexoki',
        author: 'Organic Palette',
        config: `return {
\t{
\t\t"kepano/flexoki-neovim",
\t\tname = "flexoki",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "flexoki-dark",
\t\t},
\t},
}`
    },
    {
        name: 'GitHub Dark',
        author: 'GitHub',
        config: `return {
\t{
\t\t"projekt0n/github-nvim-theme",
\t\tname = "github-theme",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "github_dark",
\t\t},
\t},
}`
    },
    {
        name: 'Monokai Pro',
        author: 'Sublime Classic',
        config: `return {
\t{
\t\t"loctvl842/monokai-pro.nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\tfilter = "pro",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "monokai-pro",
\t\t},
\t},
}`
    },
    {
        name: 'Oxocarbon',
        author: 'IBM Carbon',
        config: `return {
\t{
\t\t"nyoom-engineering/oxocarbon.nvim",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "oxocarbon",
\t\t},
\t},
}`
    },
    {
        name: 'Modus Vivendi',
        author: 'Emacs Port',
        config: `return {
\t{
\t\t"miikanissi/modus-themes.nvim",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "modus_vivendi",
\t\t},
\t},
}`
    },
    {
        name: 'Solarized Dark',
        author: 'Precision Colors',
        config: `return {
\t{
\t\t"maxmx03/solarized.nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\tvariant = "autumn",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "solarized",
\t\t},
\t},
}`
    },
    {
        name: 'Solarized Light',
        author: 'Precision Colors',
        config: `return {
\t{
\t\t"maxmx03/solarized.nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\tvariant = "spring",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "solarized",
\t\t},
\t},
}`
    },
    {
        name: 'Gruvbox Light',
        author: 'Retro Groove',
        config: `return {
\t{
\t\t"ellisonleao/gruvbox.nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\tcontrast = "hard",
\t\t},
\t\tconfig = function()
\t\t\tvim.o.background = "light"
\t\tend,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "gruvbox",
\t\t},
\t},
}`
    },
    {
        name: 'Catppuccin Latte',
        author: 'Soothing Pastel',
        config: `return {
\t{
\t\t"catppuccin/nvim",
\t\tname = "catppuccin",
\t\tpriority = 1000,
\t\topts = {
\t\t\tflavour = "latte",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "catppuccin",
\t\t},
\t},
}`
    },
    {
        name: 'One Light',
        author: 'Atom Inspired',
        config: `return {
\t{
\t\t"navarasu/onedark.nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\tstyle = "light",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "onedark",
\t\t},
\t},
}`
    },
    {
        name: 'Rose Pine Dawn',
        author: 'Rosé Pine',
        config: `return {
\t{
\t\t"rose-pine/neovim",
\t\tname = "rose-pine",
\t\tpriority = 1000,
\t\topts = {
\t\t\tvariant = "dawn",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "rose-pine",
\t\t},
\t},
}`
    },
    {
        name: 'Everforest Light',
        author: 'Nature Inspired',
        config: `return {
\t{
\t\t"neanias/everforest-nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\tbackground = "hard",
\t\t},
\t\tconfig = function()
\t\t\tvim.o.background = "light"
\t\tend,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "everforest",
\t\t},
\t},
}`
    },
    {
        name: 'Tokyo Night Day',
        author: 'Day Coding',
        config: `return {
\t{
\t\t"folke/tokyonight.nvim",
\t\tpriority = 1000,
\t\topts = {
\t\t\tstyle = "day",
\t\t},
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "tokyonight",
\t\t},
\t},
}`
    },
    {
        name: 'GitHub Light',
        author: 'GitHub',
        config: `return {
\t{
\t\t"projekt0n/github-nvim-theme",
\t\tname = "github-theme",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "github_light",
\t\t},
\t},
}`
    },
    {
        name: 'Ayu Mirage',
        author: 'Modern Elegance',
        config: `return {
\t{
\t\t"Shatur/neovim-ayu",
\t\tpriority = 1000,
\t\tconfig = function()
\t\t\tvim.g.ayu_mirage = true
\t\tend,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "ayu",
\t\t},
\t},
}`
    },
    {
        name: 'Oceanic Next',
        author: 'Ocean Inspired',
        config: `return {
\t{
\t\t"mhartington/oceanic-next",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "OceanicNext",
\t\t},
\t},
}`
    },
    {
        name: 'Horizon',
        author: 'Red Sunset',
        config: `return {
\t{
\t\t"akinsho/horizon.nvim",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "horizon",
\t\t},
\t},
}`
    },
    {
        name: 'Andromeda',
        author: 'Sci-Fi Dreams',
        config: `return {
\t{
\t\t"safv12/andromeda.vim",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "andromeda",
\t\t},
\t},
}`
    },
    {
        name: 'Synthwave 84',
        author: 'Retro Neon',
        config: `return {
\t{
\t\t"artanikin/vim-synthwave84",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "synthwave84",
\t\t},
\t},
}`
    },
    {
        name: 'Palenight',
        author: 'Material Theme',
        config: `return {
\t{
\t\t"drewtempelmeyer/palenight.vim",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "palenight",
\t\t},
\t},
}`
    },
    {
        name: 'Monochrome Dark',
        author: 'Pure Minimalism',
        config: `return {
\t{
\t\t"kdheepak/monochrome.nvim",
\t\tpriority = 1000,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "monochrome",
\t\t},
\t},
}`
    },
    {
        name: 'Monochrome Light',
        author: 'Pure Minimalism',
        config: `return {
\t{
\t\t"kdheepak/monochrome.nvim",
\t\tpriority = 1000,
\t\tconfig = function()
\t\t\tvim.o.background = "light"
\t\tend,
\t},
\t{
\t\t"LazyVim/LazyVim",
\t\topts = {
\t\t\tcolorscheme = "monochrome",
\t\t},
\t},
}`
    },
];
