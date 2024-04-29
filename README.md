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

Thinking: this will create a social dynamic where it requires both coordination and competition. The game duration is determined through these social factors, therefore as the game progresses and grows in traction it can be extended to include more people and more time.
- Simple Mechanics
- Social Factors
- Competition and Coordination required
- Randomized


#### Based on Feedback
Make the game repeatable v 1 time game
- Action: Expires but keep track of winners consistently
Varying reward for round, increasing as more rounds are lost
- Action: Base reward, and factor to increase reward as more rounds are lost

#### Open Questions
- How to make it apparent that a round is won by a person?
  - Winners page or a way to search if you won a round? 
    - Set inclusion, have a tuple: Users -> 

## TODO
- [X] Base game logic
- [X] Round expires logic
- [X] currClicks exceeds targetNum
- [X] atomic Redis updates
- [X] Hosted on Vercel

Based on Feedba
#### UI Updates
Waiting on Swell update to image assets, focused on logic
- [ ] Intro slide imagery
- [X] Game State slide imagery
- [ ] Final slide imagery for game over
- [ ] Convert HStack to Columns
- [ ] Update fonts to match Swell

### Nice to Haves
- [ ] Update domain link to Swell, if possible
- [ ] Those who have broken game previously no longer eligible (prevent spam)
- [ ] Usernames of people who have a spot in the round
- [ ] Refactor logic for readability, seperate out utils