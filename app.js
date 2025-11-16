// State management
let currentStandings = [];
let conferences = [];
let selectedConference = null;
let allTeams = [];
let currentViewMode = 'top25';
let manualSelectionMode = false;
let selectedTeams = [];
let customItems = [];

// API Configuration
const ESPN_FBS_API_URL = 'https://site.web.api.espn.com/apis/v2/sports/football/college-football/standings';
const ESPN_FCS_API_URL = 'https://site.web.api.espn.com/apis/v2/sports/football/college-football/standings?group=81';

// Initialize the application
async function init() {
    await fetchStandings();
    setupEventListeners();
}

// Fetch standings from ESPN API
async function fetchStandings() {
    try {
        // Fetch both FBS and FCS data
        const [fbsResponse, fcsResponse] = await Promise.all([
            fetch(ESPN_FBS_API_URL),
            fetch(ESPN_FCS_API_URL)
        ]);
        
        const fbsData = await fbsResponse.json();
        const fcsData = await fcsResponse.json();
        
        // Extract FBS conferences
        if (fbsData.children) {
            conferences = fbsData.children.map(conf => ({
                id: conf.id,
                name: conf.name,
                abbreviation: conf.abbreviation,
                standings: conf.standings,
                division: 'FBS'
            }));
        }
        
        // Extract and add FCS conferences
        if (fcsData.children) {
            const fcsConferences = fcsData.children.map(conf => ({
                id: `fcs-${conf.id}`,
                name: `${conf.name} (FCS)`,
                abbreviation: conf.abbreviation,
                standings: conf.standings,
                division: 'FCS'
            }));
            conferences = [...conferences, ...fcsConferences];
        }
        
        // Extract all teams from both divisions
        if (conferences.length > 0) {
            
            // Extract all teams with their national rankings for top 25
            allTeams = [];
            conferences.forEach(conf => {
                if (conf.standings && conf.standings.entries) {
                    conf.standings.entries.forEach(entry => {
                        // Use the rank directly from the team object
                        const rank = entry.team.rank;
                        
                        // Only include teams that have a rank
                        if (rank && rank > 0) {
                            allTeams.push({
                                rank: rank,
                                team: entry.team.displayName,
                                shortName: entry.team.shortDisplayName,
                                conference: conf.name,
                                record: getTeamRecord(entry.stats),
                                stats: entry.stats
                            });
                        }
                    });
                }
            });
            
            // Sort all teams by rank
            allTeams.sort((a, b) => a.rank - b.rank);
            
            populateConferenceDropdown();
            
            // Display top 25 by default
            displayTop25();
        }
    } catch (error) {
        console.error('Error fetching standings:', error);
        showError('Failed to load standings data. Please try again later.');
    }
}

// Populate conference dropdown
function populateConferenceDropdown() {
    const select = document.getElementById('conference-select');
    select.innerHTML = '<option value="">Select a conference...</option>';
    
    conferences.forEach(conf => {
        const option = document.createElement('option');
        option.value = conf.id;
        option.textContent = conf.name;
        select.appendChild(option);
    });
}

// Display standings for selected conference
function displayStandings(conferenceId) {
    const conference = conferences.find(c => c.id === conferenceId);
    if (!conference || !conference.standings) {
        return;
    }
    
    const container = document.getElementById('standings-container');
    const entries = conference.standings.entries || [];
    
    if (entries.length === 0) {
        container.innerHTML = '<p>No standings data available for this conference.</p>';
        return;
    }
    
    // Store current standings
    currentStandings = entries.map((entry, index) => {
        // Get playoff seed from stats, fallback to index + 1
        const playoffSeedStat = entry.stats.find(s => s.name === 'playoffSeed');
        const rank = playoffSeedStat && playoffSeedStat.value > 0 ? playoffSeedStat.value : index + 1;
        
        return {
            rank: rank,
            team: entry.team.displayName,
            shortName: entry.team.shortDisplayName,
            record: getTeamRecord(entry.stats),
            stats: entry.stats
        };
    });
    
    // Sort by rank to ensure proper ordering
    currentStandings.sort((a, b) => a.rank - b.rank);
    
    // Render standings
    renderStandingsList(currentStandings, container);
}

// Render standings list with optional selection
function renderStandingsList(teams, container) {
    container.innerHTML = teams.map((team, index) => {
        const isSelected = selectedTeams.some(t => t.team === team.team);
        const selectableClass = manualSelectionMode ? 'selectable' : '';
        const selectedClass = isSelected ? 'selected' : '';
        
        return `
            <div class="standing-item ${selectableClass} ${selectedClass}" 
                 data-team-index="${index}"
                 ${manualSelectionMode ? 'onclick="toggleTeamSelection(this)"' : ''}>
                <div class="standing-rank">${team.rank}</div>
                <div class="standing-team">
                    <span class="team-name">${team.team}</span>
                    <span class="team-record">${team.record}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Extract team record from stats
function getTeamRecord(stats) {
    const overallStat = stats.find(s => s.name === 'overall' || s.type === 'total');
    if (overallStat && overallStat.displayValue) {
        return overallStat.displayValue;
    }
    
    // Fallback: try to find wins and losses
    const wins = stats.find(s => s.name === 'wins');
    const losses = stats.find(s => s.name === 'losses');
    
    if (wins && losses) {
        return `${wins.value}-${losses.value}`;
    }
    
    return 'N/A';
}

// Display top 25 rankings
function displayTop25() {
    const container = document.getElementById('standings-container');
    const title = document.getElementById('standings-title');
    title.textContent = 'Top 25 Rankings';
    
    if (allTeams.length === 0) {
        container.innerHTML = '<p>No rankings data available.</p>';
        return;
    }
    
    // Get top 25 teams
    const top25 = allTeams.slice(0, 25);
    currentStandings = top25;
    
    // Render top 25
    renderStandingsList(top25, container);
}

// Display top 2 from each conference
function displayTop2FromEachConference() {
    const container = document.getElementById('standings-container');
    const title = document.getElementById('standings-title');
    title.textContent = 'Top 2 From Each Conference';
    
    if (conferences.length === 0) {
        container.innerHTML = '<p>No conference data available.</p>';
        return;
    }
    
    currentStandings = [];
    let html = '';
    
    conferences.forEach(conf => {
        if (!conf.standings || !conf.standings.entries || conf.standings.entries.length === 0) {
            return;
        }
        
        // Get entries and sort by playoff seed
        const entries = conf.standings.entries.map((entry, index) => {
            const playoffSeedStat = entry.stats.find(s => s.name === 'playoffSeed');
            const rank = playoffSeedStat && playoffSeedStat.value > 0 ? playoffSeedStat.value : index + 1;
            
            return {
                rank: rank,
                team: entry.team.displayName,
                shortName: entry.team.shortDisplayName,
                conference: conf.name,
                record: getTeamRecord(entry.stats),
                stats: entry.stats
            };
        });
        
        // Sort by rank and get top 2
        entries.sort((a, b) => a.rank - b.rank);
        const top2 = entries.slice(0, 2);
        
        // Add to current standings
        currentStandings.push(...top2);
        
        // Add conference header
        html += `<div class="conference-header">${conf.name}</div>`;
        
        // Add top 2 teams
        html += top2.map((team, index) => {
            const globalIndex = currentStandings.indexOf(team);
            const isSelected = selectedTeams.some(t => t.team === team.team);
            const selectableClass = manualSelectionMode ? 'selectable' : '';
            const selectedClass = isSelected ? 'selected' : '';
            
            return `
                <div class="standing-item ${selectableClass} ${selectedClass}" 
                     data-team-index="${globalIndex}"
                     ${manualSelectionMode ? 'onclick="toggleTeamSelection(this)"' : ''}>
                    <div class="standing-rank">${team.rank}</div>
                    <div class="standing-team">
                        <span class="team-name">${team.team}</span>
                        <span class="team-record">${team.record}</span>
                    </div>
                </div>
            `;
        }).join('');
    });
    
    container.innerHTML = html || '<p>No teams available.</p>';
}

// Toggle team selection
function toggleTeamSelection(element) {
    if (!manualSelectionMode) return;
    
    const teamIndex = parseInt(element.dataset.teamIndex);
    const team = currentStandings[teamIndex];
    
    if (!team) return;
    
    const existingIndex = selectedTeams.findIndex(t => t.team === team.team);
    
    if (existingIndex >= 0) {
        selectedTeams.splice(existingIndex, 1);
    } else {
        selectedTeams.push({...team});
    }
    
    // Update button text
    const generateBtn = document.getElementById('generate-btn');
    generateBtn.textContent = `Generate Bracket (${selectedTeams.length} teams selected)`;
    
    // Re-render the current view
    refreshCurrentView();
}

// Refresh the current view
function refreshCurrentView() {
    const container = document.getElementById('standings-container');
    
    if (currentViewMode === 'top25') {
        displayTop25();
    } else if (currentViewMode === 'top2') {
        displayTop2FromEachConference();
    } else if (currentViewMode === 'custom') {
        displayCustomList();
    } else if (selectedConference) {
        displayStandings(selectedConference);
    }
}

// Apply seeding method to teams
function applySeedingMethod(teams, method) {
    const teamsWithStats = teams.map(team => {
        const pointDiffStat = team.stats.find(s => s.name === 'pointDifferential');
        const winsStat = team.stats.find(s => s.name === 'wins');
        const lossesStat = team.stats.find(s => s.name === 'losses');
        const winPercentStat = team.stats.find(s => s.name === 'winPercent' || s.name === 'leagueWinPercent');
        
        return {
            ...team,
            pointDifferential: pointDiffStat ? parseFloat(pointDiffStat.value) : 0,
            totalWins: winsStat ? parseFloat(winsStat.value) : 0,
            totalLosses: lossesStat ? parseFloat(lossesStat.value) : 0,
            winPercent: winPercentStat ? parseFloat(winPercentStat.value) : 0
        };
    });
    
    // Sort based on method
    switch(method) {
        case 'pointDifferential':
            teamsWithStats.sort((a, b) => b.pointDifferential - a.pointDifferential);
            break;
        case 'wins':
            teamsWithStats.sort((a, b) => b.totalWins - a.totalWins);
            break;
        case 'winPercent':
            teamsWithStats.sort((a, b) => b.winPercent - a.winPercent);
            break;
        case 'standings':
        default:
            teamsWithStats.sort((a, b) => a.rank - b.rank);
            break;
    }
    
    // Re-assign ranks based on new order
    return teamsWithStats.map((team, index) => ({
        ...team,
        rank: index + 1
    }));
}

// Setup event listeners
function setupEventListeners() {
    const viewMode = document.getElementById('view-mode');
    const conferenceSelect = document.getElementById('conference-select');
    const conferenceGroup = document.getElementById('conference-group');
    const generateBtn = document.getElementById('generate-btn');
    const title = document.getElementById('standings-title');
    const manualSelectionCheckbox = document.getElementById('manual-selection');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    
    // Hide conference group on page load since top25 is default
    conferenceGroup.style.display = 'none';
    
    viewMode.addEventListener('change', (e) => {
        currentViewMode = e.target.value;
        
        const standingsContainer = document.getElementById('standings-container');
        const customListContainer = document.getElementById('custom-list-container');
        
        if (currentViewMode === 'custom') {
            conferenceGroup.style.display = 'none';
            standingsContainer.style.display = 'none';
            customListContainer.style.display = 'block';
            title.textContent = 'Custom List';
            displayCustomList();
        } else {
            standingsContainer.style.display = 'block';
            customListContainer.style.display = 'none';
            
            if (currentViewMode === 'top25') {
                conferenceGroup.style.display = 'none';
                displayTop25();
            } else if (currentViewMode === 'top2') {
                conferenceGroup.style.display = 'none';
                displayTop2FromEachConference();
            } else {
                conferenceGroup.style.display = 'block';
                title.textContent = 'Current Standings';
                if (selectedConference) {
                    displayStandings(selectedConference);
                } else {
                    standingsContainer.innerHTML = '<p>Select a conference to view standings...</p>';
                }
            }
        }
    });
    
    conferenceSelect.addEventListener('change', (e) => {
        selectedConference = e.target.value;
        if (selectedConference && currentViewMode === 'conference') {
            displayStandings(selectedConference);
        }
    });
    
    manualSelectionCheckbox.addEventListener('change', (e) => {
        manualSelectionMode = e.target.checked;
        selectedTeams = [];
        refreshCurrentView();
        
        if (manualSelectionMode) {
            generateBtn.textContent = `Generate Bracket (${selectedTeams.length} teams selected)`;
        } else {
            generateBtn.textContent = 'Generate Bracket';
        }
    });
    
    generateBtn.addEventListener('click', generateBracket);
    
    exportPdfBtn.addEventListener('click', exportToPDF);
    
    // Bracket tab switching
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
            switchBracketTab(e.target.dataset.tab);
        }
    });
    
    // Custom list event listeners
    const addCustomItemBtn = document.getElementById('add-custom-item-btn');
    const customItemInput = document.getElementById('custom-item-input');
    const clearCustomListBtn = document.getElementById('clear-custom-list-btn');
    const importCustomListBtn = document.getElementById('import-custom-list-btn');
    
    addCustomItemBtn.addEventListener('click', addCustomItem);
    customItemInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addCustomItem();
        }
    });
    clearCustomListBtn.addEventListener('click', clearCustomList);
    importCustomListBtn.addEventListener('click', importCustomList);
}

// Generate bracket based on user selections
function generateBracket() {
    const teamCount = parseInt(document.getElementById('team-count').value);
    const weekCount = parseInt(document.getElementById('week-count').value);
    const seedingMethod = document.getElementById('seeding-method').value;
    
    // Determine which teams to use
    let bracketTeams;
    
    if (manualSelectionMode) {
        if (selectedTeams.length === 0) {
            alert('Please select at least some teams first!');
            return;
        }
        
        if (selectedTeams.length < teamCount) {
            const proceed = confirm(`You've only selected ${selectedTeams.length} teams but want a ${teamCount}-team bracket. Use selected teams anyway?`);
            if (!proceed) return;
            bracketTeams = [...selectedTeams];
        } else {
            bracketTeams = selectedTeams.slice(0, teamCount);
        }
    } else {
        // Check if using custom list
        if (currentViewMode === 'custom') {
            if (customItems.length === 0) {
                alert('Please add items to your custom list first!');
                return;
            }
            
            bracketTeams = customItems.slice(0, teamCount);
            
            if (bracketTeams.length < teamCount) {
                const proceed = confirm(`You have ${bracketTeams.length} items but want a ${teamCount}-team bracket. Use available items anyway?`);
                if (!proceed) return;
            }
        } else {
            if (currentStandings.length === 0) {
                alert('Please select a view mode or conference first!');
                return;
            }
            
            bracketTeams = currentStandings.slice(0, teamCount);
            
            if (bracketTeams.length < teamCount) {
                alert(`Only ${bracketTeams.length} teams available!`);
                return;
            }
        }
    }
    
    // Validate team count vs week count
    let requiredWeeks;
    if (bracketTeams.length === 46) {
        requiredWeeks = 6; // 46 -> 32 -> 16 -> 8 -> 4 -> 2 -> 1 (6 rounds)
    } else {
        requiredWeeks = Math.ceil(Math.log2(bracketTeams.length));
    }
    
    if (weekCount < requiredWeeks) {
        alert(`You need at least ${requiredWeeks} weeks for ${bracketTeams.length} teams!`);
        return;
    }
    
    // Apply seeding method
    const seededTeams = applySeedingMethod(bracketTeams, seedingMethod);
    
    // Create bracket structure
    const bracket = createBracketStructure(seededTeams, weekCount);
    
    // Store seeded teams for seeding view
    bracketTeamsSeeding = seededTeams.map((team, index) => ({
        ...team,
        seed: index + 1
    }));
    
    // Render bracket
    renderBracket(bracket, weekCount);
    
    // Render seeding view
    renderSeedingView();
    
    // Show export button and tabs
    const exportBtn = document.getElementById('export-pdf-btn');
    exportBtn.style.display = 'inline-block';
    
    const bracketTabs = document.getElementById('bracket-tabs');
    bracketTabs.style.display = 'flex';
    
    // Switch to bracket view by default
    switchBracketTab('bracket');
}

// Create bracket structure with proper tournament seeding
function createBracketStructure(teams, weeks) {
    const rounds = [];
    const teamCount = teams.length;
    
    // Special handling for 46-team bracket (46 teams -> 32 round 2 -> 16 -> 8 -> 4 -> 2 -> 1)
    if (teamCount === 46) {
        return create46TeamBracket(teams, weeks);
    }
    
    // Generate proper bracket seeding order (ensures #1 and #2 seeds are in opposite halves)
    const seedingOrder = generateSeedingOrder(teamCount);
    
    // Calculate matchups for first round based on proper seeding
    const firstRoundMatchups = [];
    const matchupsNeeded = teamCount / 2;
    
    for (let i = 0; i < matchupsNeeded; i++) {
        const seed1Index = seedingOrder[i * 2] - 1;
        const seed2Index = seedingOrder[i * 2 + 1] - 1;
        
        const team1 = teams[seed1Index] || { rank: 'TBD', team: 'TBD', record: '', selected: false };
        const team2 = teams[seed2Index] || { rank: 'TBD', team: 'TBD', record: '', selected: false };
        
        firstRoundMatchups.push({
            id: `r0-m${i}`,
            team1: { ...team1, selected: false },
            team2: { ...team2, selected: false }
        });
    }
    
    rounds.push(firstRoundMatchups);
    
    // Create subsequent rounds with TBD teams
    let currentRoundSize = matchupsNeeded;
    for (let round = 1; round < weeks; round++) {
        currentRoundSize = currentRoundSize / 2;
        const roundMatchups = [];
        
        for (let i = 0; i < currentRoundSize; i++) {
            roundMatchups.push({
                id: `r${round}-m${i}`,
                team1: { rank: 'TBD', team: 'TBD', record: '', selected: false },
                team2: { rank: 'TBD', team: 'TBD', record: '', selected: false }
            });
        }
        
        rounds.push(roundMatchups);
    }
    
    return rounds;
}

// Create special 46-team bracket with byes
function create46TeamBracket(teams, weeks) {
    const rounds = [];
    
    // 46 teams: 18 teams get byes, 28 teams play in first round (14 games)
    // After round 1: 18 (byes) + 14 (winners) = 32 teams for round 2
    
    // Round 1: Seeds 19-46 play (14 matchups)
    const firstRoundMatchups = [];
    for (let i = 0; i < 14; i++) {
        const higherSeed = teams[18 + i] || { rank: 'TBD', team: 'TBD', record: '', selected: false };
        const lowerSeed = teams[45 - i] || { rank: 'TBD', team: 'TBD', record: '', selected: false };
        
        firstRoundMatchups.push({
            id: `r0-m${i}`,
            team1: { ...higherSeed, selected: false },
            team2: { ...lowerSeed, selected: false }
        });
    }
    rounds.push(firstRoundMatchups);
    
    // Round 2: Top 18 seeds (with byes) vs 14 winners (16 matchups to get to 16)
    const secondRoundMatchups = [];
    
    // Top seeds get matched with first round winners
    const byeSeeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    
    for (let i = 0; i < 16; i++) {
        const byeTeam = teams[i] || { rank: 'TBD', team: 'TBD', record: '', selected: false };
        
        secondRoundMatchups.push({
            id: `r1-m${i}`,
            team1: { ...byeTeam, selected: false },
            team2: { rank: 'TBD', team: 'TBD', record: '', selected: false }
        });
    }
    rounds.push(secondRoundMatchups);
    
    // Remaining rounds: standard 16 -> 8 -> 4 -> 2 -> 1
    let currentRoundSize = 8;
    for (let round = 2; round < weeks; round++) {
        const roundMatchups = [];
        
        for (let i = 0; i < currentRoundSize; i++) {
            roundMatchups.push({
                id: `r${round}-m${i}`,
                team1: { rank: 'TBD', team: 'TBD', record: '', selected: false },
                team2: { rank: 'TBD', team: 'TBD', record: '', selected: false }
            });
        }
        
        rounds.push(roundMatchups);
        currentRoundSize = currentRoundSize / 2;
    }
    
    return rounds;
}

// Generate proper tournament seeding order
// This ensures top seeds are placed in opposite halves of the bracket
function generateSeedingOrder(teamCount) {
    if (teamCount === 2) return [1, 2];
    
    // Standard tournament seeding patterns
    const seedingPatterns = {
        4: [1, 4, 2, 3],
        8: [1, 8, 4, 5, 2, 7, 3, 6],
        16: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11],
        32: [1, 32, 16, 17, 8, 25, 9, 24, 4, 29, 13, 20, 5, 28, 12, 21, 
             2, 31, 15, 18, 7, 26, 10, 23, 3, 30, 14, 19, 6, 27, 11, 22],
        64: [1, 64, 32, 33, 16, 49, 17, 48, 8, 57, 25, 40, 9, 56, 24, 41,
             4, 61, 29, 36, 13, 52, 20, 45, 5, 60, 28, 37, 12, 53, 21, 44,
             2, 63, 31, 34, 15, 50, 18, 47, 7, 58, 26, 39, 10, 55, 23, 42,
             3, 62, 30, 35, 14, 51, 19, 46, 6, 59, 27, 38, 11, 54, 22, 43]
    };
    
    if (seedingPatterns[teamCount]) {
        return seedingPatterns[teamCount];
    }
    
    // For non-standard sizes, generate algorithmically
    const rounds = Math.log2(teamCount);
    let seeds = [1, 2];
    
    for (let i = 1; i < rounds; i++) {
        const newSeeds = [];
        const offset = Math.pow(2, i + 1) + 1;
        
        for (let seed of seeds) {
            newSeeds.push(seed);
            newSeeds.push(offset - seed);
        }
        
        seeds = newSeeds;
    }
    
    return seeds;
}

// Store bracket state
let bracketState = null;
let bracketTeamsSeeding = [];
let currentBracketView = 'bracket';

// Render the bracket
function renderBracket(bracket, weeks) {
    const container = document.getElementById('bracket-container');
    bracketState = bracket;
    
    const roundNames = getRoundNames(weeks, bracket[0].length * 2);
    
    container.innerHTML = `
        <div class="bracket">
            ${bracket.map((round, roundIndex) => `
                <div class="bracket-round">
                    <div class="round-title">${roundNames[roundIndex]}</div>
                    <div class="bracket-round-content">
                        ${round.map((matchup, matchupIndex) => `
                        <div class="matchup" data-matchup-id="${matchup.id}">
                            <div class="team ${matchup.team1.selected ? 'winner' : ''}" 
                                 data-round="${roundIndex}" 
                                 data-matchup="${matchupIndex}" 
                                 data-team="1"
                                 ${matchup.team1.team !== 'TBD' ? 'onclick="selectWinner(this)"' : ''}>
                                <div class="team-info">
                                    <span class="seed">${matchup.team1.rank !== 'TBD' ? matchup.team1.rank : '-'}</span>
                                    <div>
                                        <div class="team-name-bracket">${matchup.team1.team}</div>
                                        ${matchup.team1.record ? `<div class="team-record-bracket">${matchup.team1.record}</div>` : ''}
                                    </div>
                                </div>
                                <span class="winner-indicator">✓</span>
                            </div>
                            <div class="team ${matchup.team2.selected ? 'winner' : ''}" 
                                 data-round="${roundIndex}" 
                                 data-matchup="${matchupIndex}" 
                                 data-team="2"
                                 ${matchup.team2.team !== 'TBD' ? 'onclick="selectWinner(this)"' : ''}>
                                <div class="team-info">
                                    <span class="seed">${matchup.team2.rank !== 'TBD' ? matchup.team2.rank : '-'}</span>
                                    <div>
                                        <div class="team-name-bracket">${matchup.team2.team}</div>
                                        ${matchup.team2.record ? `<div class="team-record-bracket">${matchup.team2.record}</div>` : ''}
                                    </div>
                                </div>
                                <span class="winner-indicator">✓</span>
                            </div>
                        </div>
                    `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Handle winner selection
function selectWinner(element) {
    const round = parseInt(element.dataset.round);
    const matchup = parseInt(element.dataset.matchup);
    const team = parseInt(element.dataset.team);
    
    if (!bracketState || !bracketState[round] || !bracketState[round][matchup]) {
        return;
    }
    
    const currentMatchup = bracketState[round][matchup];
    
    // Get the winning team data
    const winner = team === 1 ? currentMatchup.team1 : currentMatchup.team2;
    
    // Don't allow selection of TBD teams
    if (winner.team === 'TBD') {
        return;
    }
    
    // Toggle selection in current matchup
    currentMatchup.team1.selected = team === 1;
    currentMatchup.team2.selected = team === 2;
    
    // Advance winner to next round if it exists
    if (round < bracketState.length - 1) {
        const nextRound = round + 1;
        let nextMatchup, nextTeamSlot;
        
        // Special handling for 46-team bracket round 1 -> round 2
        if (bracketState[0].length === 14 && round === 0) {
            // Round 1 has 14 games, round 2 has 16 games (first 2 are byes)
            // Winners from round 1 go to team2 position in round 2
            nextMatchup = matchup;
            nextTeamSlot = 'team2';
        } else {
            // Standard bracket advancement
            nextMatchup = Math.floor(matchup / 2);
            nextTeamSlot = matchup % 2 === 0 ? 'team1' : 'team2';
        }
        
        if (bracketState[nextRound] && bracketState[nextRound][nextMatchup]) {
            bracketState[nextRound][nextMatchup][nextTeamSlot] = {
                ...winner,
                selected: false
            };
            
            // Clear any winner selection in the next round matchup
            const nextMatchupObj = bracketState[nextRound][nextMatchup];
            nextMatchupObj.team1.selected = false;
            nextMatchupObj.team2.selected = false;
            
            // Clear subsequent rounds
            clearSubsequentRounds(nextRound, nextMatchup);
        }
    }
    
    // Re-render bracket
    const teamCount = bracketState[0].length * 2;
    const weeks = bracketState.length;
    renderBracket(bracketState, weeks);
}

// Export bracket to PDF
function exportToPDF() {
    // Show export button is working
    const exportBtn = document.getElementById('export-pdf-btn');
    const originalText = exportBtn.textContent;
    exportBtn.textContent = '📄 Preparing PDF...';
    exportBtn.disabled = true;
    
    // Add print class to body for print-specific styles
    document.body.classList.add('printing');
    
    // Trigger print dialog
    setTimeout(() => {
        window.print();
        
        // Restore button state
        exportBtn.textContent = originalText;
        exportBtn.disabled = false;
        document.body.classList.remove('printing');
    }, 100);
}

// Clear teams from subsequent rounds when a selection changes
function clearSubsequentRounds(startRound, startMatchup) {
    for (let round = startRound + 1; round < bracketState.length; round++) {
        const matchupIndex = Math.floor(startMatchup / Math.pow(2, round - startRound));
        
        if (bracketState[round] && bracketState[round][matchupIndex]) {
            const teamSlot = Math.floor(startMatchup / Math.pow(2, round - startRound - 1)) % 2 === 0 ? 'team1' : 'team2';
            bracketState[round][matchupIndex][teamSlot] = {
                rank: 'TBD',
                team: 'TBD',
                record: '',
                selected: false
            };
        }
    }
}

// Get round names based on number of weeks
function getRoundNames(weeks, totalTeams) {
    const names = {
        16: ['First Round', 'Quarterfinals', 'Semifinals', 'Championship'],
        8: ['Quarterfinals', 'Semifinals', 'Championship'],
        4: ['Semifinals', 'Championship']
    };
    
    if (totalTeams === 12) {
        return ['First Round', 'Quarterfinals', 'Semifinals', 'Championship'];
    }
    
    if (totalTeams === 46) {
        return ['First Round', 'Round of 32', 'Sweet 16', 'Elite 8', 'Semifinals', 'Championship'];
    }
    
    if (names[totalTeams]) {
        return names[totalTeams].slice(-weeks);
    }
    
    // Generic round names
    const roundNames = [];
    for (let i = weeks; i > 0; i--) {
        if (i === 1) {
            roundNames.push('Championship');
        } else if (i === 2) {
            roundNames.push('Semifinals');
        } else if (i === 3) {
            roundNames.push('Quarterfinals');
        } else {
            roundNames.push(`Round ${weeks - i + 1}`);
        }
    }
    
    return roundNames;
}

// Show error message
function showError(message) {
    const container = document.getElementById('standings-container');
    container.innerHTML = `<p style="color: red; padding: 20px;">${message}</p>`;
}

// Switch between bracket and seeding tabs
function switchBracketTab(tab) {
    currentBracketView = tab;
    
    const bracketContainer = document.getElementById('bracket-container');
    const seedingContainer = document.getElementById('seeding-container');
    const tabButtons = document.querySelectorAll('.tab-button');
    
    // Update active tab
    tabButtons.forEach(btn => {
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Show appropriate view
    if (tab === 'bracket') {
        bracketContainer.style.display = 'block';
        seedingContainer.style.display = 'none';
    } else {
        bracketContainer.style.display = 'none';
        seedingContainer.style.display = 'block';
    }
}

// Render seeding view
function renderSeedingView() {
    const container = document.getElementById('seeding-container');
    
    if (!bracketTeamsSeeding || bracketTeamsSeeding.length === 0) {
        container.innerHTML = '<p class="placeholder">No teams to display</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="seeding-view">
            <div class="seeding-header">
                <h3>Tournament Seeding</h3>
                <p>Drag teams to reorder seeds, then regenerate bracket to apply changes</p>
            </div>
            <div class="seeding-list" id="seeding-list">
                ${bracketTeamsSeeding.map((team, index) => `
                    <div class="seeding-item" draggable="true" data-index="${index}">
                        <div class="seeding-drag-handle">⋮⋮</div>
                        <div class="seeding-seed">
                            <input type="number" 
                                   class="seed-input" 
                                   value="${team.seed}" 
                                   min="1" 
                                   max="${bracketTeamsSeeding.length}"
                                   data-index="${index}">
                        </div>
                        <div class="seeding-team-info">
                            <div class="seeding-team-name">${team.team}</div>
                            <div class="seeding-team-details">
                                <span class="seeding-record">${team.record}</span>
                                ${team.conference ? `<span class="seeding-conference">${team.conference}</span>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="seeding-actions">
                <button id="apply-seeding-btn" class="apply-seeding-button">Apply Seeding & Regenerate Bracket</button>
                <button id="reset-seeding-btn" class="reset-seeding-button">Reset to Original</button>
            </div>
        </div>
    `;
    
    // Setup drag and drop
    setupSeedingDragDrop();
    
    // Setup seeding actions
    document.getElementById('apply-seeding-btn').addEventListener('click', applySeedingChanges);
    document.getElementById('reset-seeding-btn').addEventListener('click', resetSeeding);
    
    // Setup manual seed input changes
    document.querySelectorAll('.seed-input').forEach(input => {
        input.addEventListener('change', handleSeedInputChange);
    });
}

// Setup drag and drop for seeding
function setupSeedingDragDrop() {
    const seedingList = document.getElementById('seeding-list');
    let draggedItem = null;
    
    seedingList.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('seeding-item')) {
            draggedItem = e.target;
            e.target.style.opacity = '0.5';
        }
    });
    
    seedingList.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('seeding-item')) {
            e.target.style.opacity = '1';
        }
    });
    
    seedingList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(seedingList, e.clientY);
        if (afterElement == null) {
            seedingList.appendChild(draggedItem);
        } else {
            seedingList.insertBefore(draggedItem, afterElement);
        }
    });
    
    seedingList.addEventListener('drop', (e) => {
        e.preventDefault();
        updateSeedingOrder();
    });
}

// Get element after drag position
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.seeding-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Update seeding order after drag
function updateSeedingOrder() {
    const items = document.querySelectorAll('.seeding-item');
    const newOrder = [];
    
    items.forEach((item, index) => {
        const oldIndex = parseInt(item.dataset.index);
        newOrder.push(bracketTeamsSeeding[oldIndex]);
    });
    
    // Update seeds
    bracketTeamsSeeding = newOrder.map((team, index) => ({
        ...team,
        seed: index + 1
    }));
    
    // Re-render to update seed numbers
    renderSeedingView();
}

// Handle manual seed input changes
function handleSeedInputChange(e) {
    const index = parseInt(e.target.dataset.index);
    let newSeed = parseInt(e.target.value);
    
    // Validate seed
    if (isNaN(newSeed) || newSeed < 1 || newSeed > bracketTeamsSeeding.length) {
        e.target.value = bracketTeamsSeeding[index].seed;
        return;
    }
    
    // Move team to new position
    const team = bracketTeamsSeeding[index];
    bracketTeamsSeeding.splice(index, 1);
    bracketTeamsSeeding.splice(newSeed - 1, 0, team);
    
    // Update all seeds
    bracketTeamsSeeding = bracketTeamsSeeding.map((t, i) => ({
        ...t,
        seed: i + 1
    }));
    
    // Re-render
    renderSeedingView();
}

// Apply seeding changes and regenerate bracket
function applySeedingChanges() {
    const teamCount = parseInt(document.getElementById('team-count').value);
    const weekCount = parseInt(document.getElementById('week-count').value);
    
    // Use current seeding order
    const seededTeams = bracketTeamsSeeding.slice(0, teamCount);
    
    // Create bracket structure
    const bracket = createBracketStructure(seededTeams, weekCount);
    
    // Render bracket
    renderBracket(bracket, weekCount);
    
    // Switch to bracket view
    switchBracketTab('bracket');
    
    // Show success message
    alert('Bracket updated with new seeding!');
}

// Reset seeding to original
function resetSeeding() {
    if (confirm('Reset seeding to original order?')) {
        // Regenerate bracket with original settings
        generateBracket();
    }
}

// Display custom list
function displayCustomList() {
    const container = document.getElementById('custom-items-list');
    
    if (customItems.length === 0) {
        container.innerHTML = '<p class="placeholder-small">Add items to create your custom bracket</p>';
        return;
    }
    
    container.innerHTML = customItems.map((item, index) => {
        const isSelected = selectedTeams.some(t => t.team === item.team);
        const selectableClass = manualSelectionMode ? 'selectable' : '';
        const selectedClass = isSelected ? 'selected' : '';
        
        return `
            <div class="custom-item ${selectableClass} ${selectedClass}" 
                 data-team-index="${index}"
                 ${manualSelectionMode ? 'onclick="toggleTeamSelection(this)"' : ''}>
                <div class="custom-item-rank">${item.rank}</div>
                <div class="custom-item-name">${item.team}</div>
                <button class="remove-item-btn" onclick="removeCustomItem(${index}); event.stopPropagation();">×</button>
            </div>
        `;
    }).join('');
    
    // Update currentStandings for bracket generation
    currentStandings = customItems;
}

// Add custom item
function addCustomItem() {
    const input = document.getElementById('custom-item-input');
    const itemName = input.value.trim();
    
    if (!itemName) {
        alert('Please enter an item name!');
        return;
    }
    
    // Check for duplicates
    if (customItems.some(item => item.team.toLowerCase() === itemName.toLowerCase())) {
        alert('This item already exists in your list!');
        return;
    }
    
    // Add item
    customItems.push({
        rank: customItems.length + 1,
        team: itemName,
        shortName: itemName,
        record: '',
        stats: []
    });
    
    // Clear input
    input.value = '';
    input.focus();
    
    // Update display
    displayCustomList();
}

// Remove custom item
function removeCustomItem(index) {
    customItems.splice(index, 1);
    
    // Renumber remaining items
    customItems = customItems.map((item, i) => ({
        ...item,
        rank: i + 1
    }));
    
    // Update display
    displayCustomList();
}

// Clear custom list
function clearCustomList() {
    if (customItems.length === 0) return;
    
    if (confirm('Clear all items from your custom list?')) {
        customItems = [];
        displayCustomList();
    }
}

// Import custom list
function importCustomList() {
    const input = prompt('Paste your list of items (one per line):');
    
    if (!input) return;
    
    const items = input.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    
    if (items.length === 0) {
        alert('No valid items found!');
        return;
    }
    
    // Add items
    items.forEach(itemName => {
        // Check for duplicates
        if (!customItems.some(item => item.team.toLowerCase() === itemName.toLowerCase())) {
            customItems.push({
                rank: customItems.length + 1,
                team: itemName,
                shortName: itemName,
                record: '',
                stats: []
            });
        }
    });
    
    // Update display
    displayCustomList();
    
    alert(`Successfully imported ${items.length} items!`);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
