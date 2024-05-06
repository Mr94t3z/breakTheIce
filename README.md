```
npm install
npm run dev
```

Head to http://localhost:5173/api/dev to debug and interact

Rules of the game:
- The game is a round based game, once the *target number of people have clicked the button & time has expired, the game ends*
- A new round is started in two cases:
  - The current round has expired
  - The number of people has exceeded the target number of people
- The number of people in the round is randomly generated between 1 and 10
- Each person can only click the button once per round
- Rounds are currently limited to 3 hours

# Tasks
Currently this repo is using FrogUI to return the images, instead I would like these to be rendered dynamically with background images.

Total of 5 images to be dynamically generated, they will be generated with the images included in "public" as the background

There are 4 frames:
- Intro 
- Joining the game
  - with another image if the game is over
- Checking the Game
- Leaderboard

Include a custom font, using the font family Madimi

##### Open question: Can the "/checkGame" and "/joinTheIce" image responses be combined?
- They should be consistent but the data is reached from two different button interactions

#### Intro 
- Dynamically generate to include the current text on the right side of the screen
- Title should be across the top
- on the left side should be div so longer form text can be included
  - this will include the rules

#### Check the Game
- shows current stats of the users
- must be able to have up to 10 usernames in the "On the Ice"
- Nicely Formatted Countdown timer
  - good reference /thebutton
- Reward
- Spots Taken
- If the user is on the ice, displays a message "you're on the ice"

#### Joining the Game
- Displays the same information as the "Check the Frame" 
- Displays wether or not the user is "On the Ice" - can be checked if they are currently in the set

#### Joining the Game - broken ice
- Displays a simple message that they broke the ice and that the next round is starting

#### Leaderboard 
- Shows the top 10 users based off of total scores
  - user + score should be displayed
  - can be retrieved from getTop10(), see the existing leaderboard frame for reference
- shows the current user score (one who clicked the button)
  - good reference could be the degen.tips site
Nice to have
 - include the profile pic of the user next to the username


Overall, formatting you have some creative freedom within those bounds. 
- Text boxs should handle the case of longer text so it wraps rather than being cut off.
