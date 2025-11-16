# College Football Playoff Bracket Creator

A web application that queries ESPN's undocumented college football API to create custom playoff brackets based on current standings.

## Features

- **Live Data**: Fetches real-time college football standings from ESPN's API
- **Conference Selection**: Choose from all FBS conferences (SEC, Big Ten, ACC, Big 12, etc.)
- **Customizable Brackets**: Select the number of teams (4, 8, 12, or 16)
- **Multiple Weeks**: Configure bracket depth (2-4 weeks of playoff rounds)
- **Automatic Seeding**: Teams are seeded based on their current standings
- **Visual Bracket Display**: Clean, tournament-style bracket visualization

## How to Use

1. **Open the Application**
   - Open `index.html` in a web browser
   - Or run a local server (recommended for CORS compatibility)

2. **Select a Conference**
   - Choose a conference from the dropdown menu
   - Current standings will appear on the right

3. **Configure Your Bracket**
   - **Number of Teams**: Choose 4, 8, 12, or 16 teams
   - **Number of Weeks**: Select 2-4 weeks (playoff rounds)
   
4. **Generate Bracket**
   - Click "Generate Bracket" to create your playoff bracket
   - The bracket will show matchups with proper seeding

## Running Locally

### Option 1: Simple File Open
Open `index.html` directly in your browser. Note: Some browsers may block API requests due to CORS.

### Option 2: Local Server (Recommended)

**Using Python:**
```bash
# Python 3
python -m http.server 8000

# Then open: http://localhost:8000
```

**Using Node.js:**
```bash
npx serve
```

**Using VS Code:**
Install the "Live Server" extension and click "Go Live"

## API Information

The application uses ESPN's undocumented API:
- **Endpoint**: `https://site.web.api.espn.com/apis/v2/sports/football/college-football/standings`
- **Data Includes**: Conference standings, team records, rankings, and statistics

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling and layout
- `app.js` - JavaScript logic for API integration and bracket generation

## How It Works

1. **Data Fetching**: The app fetches conference standings from ESPN's API on page load
2. **Conference Selection**: Users select a conference to view rankings
3. **Bracket Generation**: 
   - Takes the top N teams based on standings
   - Creates proper seeding (1 vs last, 2 vs second-to-last, etc.)
   - Generates subsequent rounds with TBD placeholders
4. **Visualization**: Displays the bracket with round names and matchups

## Bracket Seeding Logic

- **4 Teams**: #1 vs #4, #2 vs #3
- **8 Teams**: #1 vs #8, #2 vs #7, #3 vs #6, #4 vs #5
- **12 Teams**: Top 4 seeds get byes, #5 vs #12, #6 vs #11, #7 vs #10, #8 vs #9
- **16 Teams**: Full bracket with all matchups

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Notes

- This uses an undocumented ESPN API that may change without notice
- The API doesn't require authentication but may have rate limits
- Bracket data shows current standings; future rounds show "TBD"

## Future Enhancements

Potential features to add:
- Interactive bracket (click to select winners)
- Export bracket as image/PDF
- Save/share bracket configurations
- Historical data comparison
- Custom team selection (override seeding)

## License

MIT License - Feel free to use and modify!

## Credits

Data provided by ESPN's College Football API
