Rules for Codex and contributors:

- Do not rename or modify existing production symbols/scripts unless explicitly requested.
- Keep one folder per symbol. In each folder, there will be : A .js file named symbol-<name>.js ; a .html file named symbol-<name>-template.html ; (optional, required if we want to add a config pane for the symbol) a .html file named symbol-<name>-config.html, where <name> is the name of the symbol.
- For the .js file, the template file Template.js must be used.
- The Example1 folder contain an example for a custom symbol that is up and running. It contains a navigation menu symbol where button are added when URL attribute are linked to the symbol.
- The Example2 folder contain another example for a custom symbol that is up and running. It contains an openlayer map, with interactive markers.
- Use plain JavaScript (avoid unnecessary frameworks).
- Document all configuration options clearly.
- Separate implementation, presentation, and configuration logic.
- Reuse code from the shared/ folder whenever possible.
- Always include a README.md for each new symbol or script.
