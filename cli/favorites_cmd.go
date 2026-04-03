package cli

import (
	"fmt"
	"os"

	"aether/internal/favorites"
)

func runListFavorites(args []string) int {
	jsonOut, _ := stripJSON(args)

	svc := favorites.NewService()
	all := svc.GetAll()

	if jsonOut {
		return printJSON(map[string]interface{}{
			"favorites": all,
			"count":     len(all),
		})
	}

	if len(all) == 0 {
		fmt.Println("No favorites.")
		return 0
	}

	fmt.Printf("Favorites (%d):\n", len(all))
	for _, fav := range all {
		fmt.Printf("  [%s] %s\n", fav.Type, fav.Path)
	}
	return 0
}

func runToggleFavorite(args []string) int {
	jsonOut, args := stripJSON(args)
	favType, args := parseFlag(args, "--type")
	if favType == "" {
		favType = "local"
	}

	if len(args) == 0 {
		msg := "Usage: aether --toggle-favorite <path> [--type local|wallhaven]"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	path := expandHome(args[0])
	svc := favorites.NewService()
	isFav := svc.Toggle(path, favType, nil)

	if jsonOut {
		return printJSON(map[string]interface{}{
			"path":        path,
			"is_favorite": isFav,
		})
	}

	if isFav {
		fmt.Printf("Added to favorites: %s\n", path)
	} else {
		fmt.Printf("Removed from favorites: %s\n", path)
	}
	return 0
}

func runIsFavorite(args []string) int {
	jsonOut, args := stripJSON(args)
	if len(args) == 0 {
		msg := "Usage: aether --is-favorite <path>"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	path := expandHome(args[0])
	svc := favorites.NewService()
	isFav := svc.IsFavorite(path)

	if jsonOut {
		return printJSON(map[string]interface{}{
			"path":        path,
			"is_favorite": isFav,
		})
	}

	if isFav {
		fmt.Printf("%s is a favorite\n", path)
	} else {
		fmt.Printf("%s is not a favorite\n", path)
	}
	return 0
}
