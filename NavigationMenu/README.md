This folder contains the custom symbol "NavigationMenu".

Files:
- `sym-navigationmenu.js`: symbol implementation and config handling.
- `sym-navigationmenu-template.html`: symbol markup.
- `sym-navigationmenu-config.html`: format pane for behavior, layout, style, and per-button settings.

Per-button editing:
- Use `Button to edit` to choose the button you want to configure.
- Changes to `Label mode`, `Custom label`, `Icon for this button`, `Icon size (px)`, `Button width (px)`, and `Button height (px)` stay in the editor until `Save to button` is pressed.
- `Icon size (px)` accepts free-form input while editing. When you save:
  - values above `48` are saved as `48`
  - values below `12` are saved as `12`
  - non-numeric, negative, or decimal values revert to the last saved icon size
- `Button width (px)` and `Button height (px)` are saved per button. Leave either field blank to use the default automatic sizing.

Button styles:
- `Normal` uses a solid button color and the existing hover color behavior.
- `Gradient Horizontal` uses `Button color 1` on the left and right, with `Button color 2` in the center.
- `Gradient Vertical` uses `Button color 1` at the top and bottom, with `Button color 2` in the center.
- Hover remains a solid `Hover color` for all styles.
