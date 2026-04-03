package cli

import (
	"fmt"
	"math/rand"
	"os"
	"strconv"

	"aether/internal/wallhaven"
	"aether/internal/wallpaper"
)

func runSearchWallhaven(args []string) int {
	jsonOut, args := stripJSON(args)
	categories, args := parseFlag(args, "--categories")
	purity, args := parseFlag(args, "--purity")
	sorting, args := parseFlag(args, "--sorting")
	order, args := parseFlag(args, "--order")
	pageStr, args := parseFlag(args, "--page")
	atLeast, args := parseFlag(args, "--at-least")
	colors, args := parseFlag(args, "--colors")

	if len(args) == 0 {
		msg := "Usage: aether --search-wallhaven <query> [--categories 111] [--purity 100] [--sorting relevance] [--page 1]"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	params := wallhaven.SearchParams{
		Query: args[0],
	}
	if categories != "" {
		params.Categories = categories
	}
	if purity != "" {
		params.Purity = purity
	}
	if sorting != "" {
		params.Sorting = sorting
	}
	if order != "" {
		params.Order = order
	}
	if pageStr != "" {
		if v, err := strconv.Atoi(pageStr); err == nil {
			params.Page = v
		}
	}
	if atLeast != "" {
		params.AtLeast = atLeast
	}
	if colors != "" {
		params.Colors = colors
	}

	client := wallhaven.NewClient()
	result, err := client.Search(params)
	if err != nil {
		msg := fmt.Sprintf("Search failed: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	if jsonOut {
		return printJSON(result)
	}

	fmt.Printf("Results: %d (page %d/%d, total %d)\n",
		len(result.Data), result.Meta.CurrentPage, result.Meta.LastPage, result.Meta.Total)
	for _, wp := range result.Data {
		fmt.Printf("  %s  %s  %s\n", wp.ID, wp.Resolution, wp.URL)
	}
	return 0
}

func runListWallpapers(args []string) int {
	jsonOut, _ := stripJSON(args)

	wallpapers, err := wallpaper.ScanDefaultDirs()
	if err != nil {
		msg := fmt.Sprintf("Failed to scan: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	if jsonOut {
		return printJSON(map[string]interface{}{
			"wallpapers": wallpapers,
			"count":      len(wallpapers),
		})
	}

	if len(wallpapers) == 0 {
		fmt.Println("No wallpapers found.")
		return 0
	}

	fmt.Printf("Local wallpapers (%d):\n", len(wallpapers))
	for _, wp := range wallpapers {
		fmt.Printf("  %s\n", wp.Path)
	}
	return 0
}

func runRandomWallpaper(args []string) int {
	jsonOut, _ := stripJSON(args)

	wallpapers, err := wallpaper.ScanDefaultDirs()
	if err != nil || len(wallpapers) == 0 {
		msg := "No wallpapers found"
		if err != nil {
			msg = fmt.Sprintf("Failed to scan: %v", err)
		}
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	pick := wallpapers[rand.Intn(len(wallpapers))]

	if jsonOut {
		return printJSON(map[string]interface{}{
			"path": pick.Path,
			"name": pick.Name,
			"size": pick.Size,
		})
	}

	fmt.Println(pick.Path)
	return 0
}
