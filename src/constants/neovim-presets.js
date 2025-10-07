/**
 * Popular Neovim color scheme presets in LazyVim format
 */

export const NEOVIM_PRESETS = [
    {
        name: 'Catppuccin',
        author: 'catppuccin',
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
        author: 'folke',
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
        author: 'ellisonleao',
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
        author: 'rose-pine',
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
        author: 'shaunsingh',
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
        author: 'rebelot',
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
        author: 'EdenEast',
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
        author: 'Mofiqul',
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
        author: 'navarasu',
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
        author: 'neanias',
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
        author: 'sainnhe',
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
        author: 'bluz71',
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
        author: 'bluz71',
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
        author: 'marko-cerovac',
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
        author: 'scottmckendry',
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
        author: 'kepano',
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
        author: 'projekt0n',
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
        author: 'loctvl842',
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
        author: 'nyoom-engineering',
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
        author: 'miikanissi',
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
        author: 'maxmx03',
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
        author: 'maxmx03',
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
        author: 'ellisonleao',
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
        author: 'catppuccin',
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
        author: 'navarasu',
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
        author: 'rose-pine',
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
        author: 'neanias',
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
        author: 'folke',
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
        author: 'projekt0n',
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
        author: 'Shatur',
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
        author: 'mhartington',
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
        author: 'akinsho',
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
        author: 'safv12',
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
        author: 'artanikin',
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
        author: 'drewtempelmeyer',
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
        author: 'kdheepak',
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
        author: 'kdheepak',
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
