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

## TODO
- [X] Base game logic
- [X] Round expires logic
- [X] currClicks exceeds targetNum
- [X] atomic Redis updates
- [X] Hosted on Vercel
- [ ] Final Slide imagery
- [ ] Intro slide imagery
- [ ] Game State slide imagery
- [ ] Final slide imagery for game over

### Nice to Haves
- [ ] Update domain link to Swell, if possible
- [ ] Cron job to automatically start round
- [ ] Those who have broken game previously no longer eligible (prevent spam)
- [ ] Usernames of people who have a spot in the round