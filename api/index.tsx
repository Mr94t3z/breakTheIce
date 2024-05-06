import { Button, Frog } from 'frog'
// import { neynar } from 'frog/hubs';
import { handle } from 'frog/vercel';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';

// Redis
import { createClient } from 'redis';
// Frog UI
import { Box, Heading, Text, VStack, Image, vars, HStack, Columns, Divider, Spacer,  } from './ui.js';

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();


// Update with redis to use functons or can do dummy data
const client = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '', 10)
  }
});


client.on('error', err => console.log('Redis Client Error', err));

await client.connect();
// Setup game constraints
const gameDuration = 1 * 60 * 100;
const gameEndTime = Date.now() + gameDuration;
// const startTargetClicks = Math.floor(Math.random() * 10) + 1;
const startTargetClicks = 1;
const roundKey = "round:clickers";
const baseReward = 1;
let roundReward = baseReward;
let potMultiplier = 1.1;

// TODO: Remove
await client.del('userScores');

client.multi()
  .del(roundKey)
  .set('roundEndTime', gameEndTime.toString())
  .set('targetClicks', startTargetClicks)
  .set('baseReward', baseReward)
  .set('roundReward', roundReward)
  .zAdd('userScores', { score: 0, value: 'Swell'})
  .exec();
// End game setup

// Function to start a new round
// Used after time limit is broken or currClicks exceeds numClicks
async function initializeGameState(increasePot: boolean ) {
  console.log("Resetting game state")
  // const targetClicks = Math.floor(Math.random() * 10) + 1;
  const targetClicks = 1; 
  // Redis calls to set the state of the game
  if(increasePot){
    // 1.2 * 1.1 instead I just want 10
    // 10% increase but to 2 sig figs
    roundReward = parseFloat((roundReward * potMultiplier).toString()).toFixed(2) as any;
  }
  try{
    client.multi()
    .set('targetClicks', targetClicks)
    .set('roundEndTime', Date.now() + gameDuration)
    .set('roundReward', roundReward)
    .del(roundKey)
    .exec();
  } catch(err){
    console.error("Error in resetting game: ", err)
  }
  

  console.log("Finished resetting");
}

// Helpers
// Function to format timeRemaining in human readable format, hours:minutes:seconds
function formatTime(timeRemaining : number) {
  let hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  let minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  let seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
  return `${hours}hrs ${minutes}mins ${seconds}secs`;
}

async function getFormattedTimeRemaining(){
  const roundEndTime = parseInt(await client.get("roundEndTime") as string, 10);
  const currTime = Date.now();
  const timeRemaining = roundEndTime - currTime;
  const timeRemainingFormatted = formatTime(timeRemaining);
  return timeRemainingFormatted;
}

// Used for fetching Farcaster username
async function getUsernames(fids: string[]) {
  // join the fids with a comma
  const fidsString = fids.join(',');
  console.log("fidsString: ", fidsString);
  const usernameUrl = 'https://api.neynar.com/v2/farcaster/user/bulk?fids=';
  // TODO - api key from env
  const neynarOptions = {
    method: 'GET',
    headers: { accept: 'application/json', api_key: process.env.NEYNAR_API_KEY || 'NEYNAR_API_DOCS' }
  };
  let temp: any = [];
  let allUsernames = [];

  console.log("about to get the username");
  // Fetch the Username from Fid
  try{
    await fetch(usernameUrl + fidsString, neynarOptions)
    .then(res => res.json())
    .then(usernameJson => {
      temp = usernameJson["users"]
    })
    .catch(err => console.error('error:' + err));
    // Loop through temp and creating a new array of "usernames" from temp[i]["username"]
    // looop through temp and only returns the "display_name" from temp[i]["display_name"]    
    for(let i = 0; i < temp.length; i++){
      allUsernames.push(temp[i]["username" as any] as string);
    }
  console.log("allUsernames: ", allUsernames);
  } catch (err) {
    console.error('error:' + err);
  }

  console.log("After getting the usernames");
  
  return allUsernames;
}

// Function to get all the fids of the users who have clicked the button and then return the usernames
async function getCurrentPlayers(){
  console.log("Calling getCurrentPlayers");
  // Call to redis to get the current players
  const currFids = await client.sMembers(roundKey);
  console.log("currFids: ", currFids);
  // No users have clicked the button
  if(currFids == null){
    return [];
  }
  console.log("currFids: ", currFids);
  // We'll have to loop and update all the individual users mappings of their rewards

  const usernames = await getUsernames(currFids);
  console.log("After getting usernames");
  return usernames;
}

async function updateWinners(){  
  // We update the winners map
  console.log("Top of update winners");
  const currFids = await client.sMembers(roundKey);
  console.log("after currFids");
  const roundReward = await client.get('roundReward');
  // Loop through the users 
  // Check if they already won
  // If so need to get their increment by the round winning 
  console.log("UpdateWinners - incrementing vals", currFids);
  for(let i in currFids){
    let currUsername = await getUsernames([currFids[i]]);
    console.log("zAdd score: ", roundReward);
    console.log("zAdd value: ", currUsername)
    let res = await client.zIncrBy('userScores', Number(roundReward), currUsername.toString());
    console.log("incrementing this fid: ", res)
  }
}

async function getTop10(){
  console.log("Top of getTop");
  const clienType = await client.type('userScores');
  console.log("Type: ", clienType)
  const topPlayers = await client.zRangeWithScores('userScores', 0, 9, { REV: true});
  console.log("TopPlayers: ", topPlayers);
  for(let player of topPlayers){
    console.log(`Username: ${player.value}, Score: ${player.score}`)
  }
  return topPlayers;
}

// Neynar
// const fetch = require('node-fetch');
// const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY ?? "";

// Utils
export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  ui: { vars },
  imageAspectRatio: '1:1',
  imageOptions: {
    height: 600,
    width: 600,
  },
  // TODO: update browser location
  // Supply a Hub to enable frame verification.
})

// Game Vars
// If X number of people click the button with 3 hour time frame
// all people split the pot
const randomNumber = Math.floor(Math.random() * 10) + 1;

app.use('/*', serveStatic({ root: './public' }))

// Public URL
const NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:5173'

// Dynamic Image URL
const FIST_FRAME_IMAGE = `${NEXT_PUBLIC_URL}/first_frame.png`

const MID_GAME_IMAGE = `${NEXT_PUBLIC_URL}/mid_game.png`

const CRACKING_ICE_IMAGE = `${NEXT_PUBLIC_URL}/cracking_ice.png`

// Default Frame
app.frame('/', async (c) => {

  return c.res({
    image: (
      <Box
        grow
        alignVertical="center"
        backgroundColor="white"
        padding="32"
        backgroundImage={`url(${FIST_FRAME_IMAGE})`}
        height="100%"
      >
        ),
          <Spacer size="16" />
          <Heading align="center" decoration='underline' color="black">Don't Break the Ice</Heading>
            <Spacer size="16" />
            <Text align="center" color="black">
              Click the button to get on the ice
            </Text>
              <VStack>
                <Text align="center" color="black">
                  Too many on the ice 
                </Text>
                <Text align="center" color="black">
                  and the game restarts
                </Text>
              </VStack>
      </Box>
    ),
    intents: [
      <Button value="grab" action="/joinTheIce">Click Me</Button>,
      <Button value="checkGame" action="/checkGame">Check Game</Button>, 
      <Button value="leaderboard" action="/leaderboard">Leaderboard</Button>,
      <Button value="rewards" action="/rewards">Check Rewards</Button>
    ],
  })
});



// Frame to check the game state
app.frame('/checkGame', async(c) => {
  // Show the number of people who have clicked the button and the remaining time in human readable format 
  // TODO: Include usernames of people who have clicked the button
  // const roundEndTime = parseInt(await client.get("roundEndTime") as string, 10);
  // get number of people who have clicked the button or 0 if no one has clickd the button
  const potentialClickers =  Number(await client.sCard(roundKey));
  const currClicks = potentialClickers != null ? potentialClickers : 0;
  console.log("potentialClickers: ", potentialClickers);
  // const currClicks = Number(await client.sCard(roundKey)) || 0;
  const targetClicks = Number(await client.get('targetClicks'));
  const roundEndTime = parseInt(await client.get("roundEndTime") as string, 10);
  const currTime = Date.now();
  const timeRemaining = roundEndTime - currTime;
  const timeRemainingFormatted = formatTime(timeRemaining);

  const roundReward = Number(await client.get('roundReward'))

  // Get the usernasmes of the people who have clicked the button
  let usernames = await getCurrentPlayers();
  console.log("usernames: ", usernames);
  console.log("currClick: ", currClicks);
  console.log("targetClicks: ", targetClicks);
  // TODO: Inlcude a way to show if the user that clicked the button is in the list of current players
  return c.res({
    image: (
      <Box
        grow
        alignVertical="center"
        backgroundColor="white"
        padding="32"
        backgroundImage={`url(${MID_GAME_IMAGE})`}
        height="100%"
      >
            <Spacer size="16" />
            <Heading align="center">Time Left</Heading>                
            <Text align="center" color="black" size="20">
              {timeRemaining <= 0 ? '0hrs 0mins 0secs' : timeRemainingFormatted}
            </Text>
            <Heading align="center">Reward</Heading>                
            <Text align="center" color="black" size="20">
              {roundReward}
            </Text>
            <Heading align="center">Spots Taken</Heading>                
            <Text align="center" color="black" size="20">
               {currClicks} / {targetClicks}
            </Text>
            <Box alignContent='center' grow flexDirection='column' paddingTop="4">
              <Heading align="center">On the Ice</Heading>
              {usernames.length > 0 ? (
                usernames.map((username) => (
                  <Text align="center" color="black" size="14" font="default">
                    {username}, you're on the ice
                  </Text>
                ))
              ) : (
                <Text align="center" color="black" size="14" font="default">
                  No users currently on the ice.
                </Text>
              )}
            </Box>
      </Box>
    ),
    intents: [
      <Button value="checkGame" action="/checkGame">Refresh</Button>,
      <Button value="rules" action="/">Rules</Button>,
    ]
  });
});


// Used to show the resulting time the button is pressed
app.frame('/joinTheIce', async(c) => {
  // Check if the game is over
  // const gameOver = await client.get('gameOver');
  // if(gameOver == 'true') {
  //   let usernames = await getCurrentPlayers();
  //   return c.res({
  //   image: (
  //       <Box
  //         grow
  //         alignVertical="center"
  //         backgroundColor="white"
  //         padding="32"
  //         backgroundImage={`url(${MID_GAME_IMAGE})`}
  //         height="100%"
  //       >
  //           <Box alignContent='center' grow flexDirection='column' paddingTop="2">
  //               <Spacer size="16" />
  //               <Box alignContent='center' grow flexDirection='column' paddingTop="4">
  //                 <Heading align="center">On the Ice</Heading>
  //                 {usernames.map((username) => (
  //                   <Text align="center" color="black" size="14" font="default">
  //                     {username}
  //                   </Text>
  //               ))}
  //               </Box>
  //           </Box>
  //     </Box>
  //   ),
  //     intents: [
  //       <Button value="checkGame" action= "/checkGame">Refresh</Button>,
  //       <Button value="rules" action="/"> Rules </Button>,
  //     ]
  //   })
  // }
  // Do game checks to see if it is over or not
  // Case - Curr Time > End Time
  const roundEndTime = parseInt(await client.get("roundEndTime") as string, 10);
  // Case - Clicks > Target Clicks
  const currClicks = Number(await client.sCard(roundKey));
  const targetClicks = Number(await client.get('targetClicks'));
  let updatedClicks;
  console.log("currClick: ", currClicks);
  console.log("targetClicks: ", targetClicks);
  // Case - round is over already
  // Check to see if the game is over or just the round
  if(Date.now() > roundEndTime){
    // Case - Round won
    if(currClicks == targetClicks) {

      console.log("Case - Round Won");
      // TODO: Final Frames to show the users who have clicked the button
      // Update those who have won the game
      await updateWinners();
      const roundWinners = await getCurrentPlayers();
      console.log("Winners: ", roundWinners)
      // Pot should not increase
      // Reset the game
      initializeGameState(false);
      console.log("After init game state, joinIce")
      return c.res({
        image: (
          <Box
            grow
            alignVertical="center"
            backgroundColor="white"
            padding="32"
            backgroundImage={`url(${MID_GAME_IMAGE})`}
            height="100%"
          >
                <Box alignContent='center' grow flexDirection='column' paddingTop="2">
                    <Spacer size="16" />
                    <Box alignContent='center' grow flexDirection='column' paddingTop="4">
                      <Heading align="center">Round Winners</Heading>
                      {roundWinners.map((roundWinners) => (
                        <Text align="center" color="black" size="14" font="default">
                          {roundWinners}
                        </Text>
                    ))}
                    </Box>
                </Box>
          </Box>
        ),
        intents: [
          <Button value="checkGame" action= "/checkGame">Refresh</Button>,
          <Button value="rules" action="/"> Rules </Button>,
        ]
      })
    } else { 
      // TODO: Update frame to be the same as the base click frame
      console.log("Case - Time expired, start new round");
      // Case - Round is over
      // Setup and start a new round
      // Increase the amount to be won
      initializeGameState(true);
      console.log("After init game state, time expired")

      // Add users to the list
       if(c.frameData?.fid != null){
        try {
          const replies = await client.multi()
            .sAdd(roundKey, (c.frameData?.fid).toString())
            .sCard(roundKey)
            .exec();
          updatedClicks = replies[1];
        } catch (err) {
          // handle error
          throw err;
        }
      }
      const timeRemainingFormatted = getFormattedTimeRemaining();

      let usernames = await getCurrentPlayers();
      // Remove
      return c.res({
        image: (
          <Box
            grow
            alignVertical="center"
            backgroundColor="white"
            padding="32"
            backgroundImage={`url(${MID_GAME_IMAGE})`}
            height="100%"
          >
                <Box alignContent='center' grow flexDirection='column' paddingTop="2">
                    <Spacer size="16" />
                    <Heading align="center">Time Left</Heading>                
                    <Text align="center" color="black" size="20">
                      {timeRemainingFormatted}
                    </Text>
                    <Heading align="center">Spots Taken</Heading>                
                    <Text align="center"color="black" size="20">
                       {currClicks} / { targetClicks }
                    </Text>
                    <Box alignContent='center' grow flexDirection='column' paddingTop="4">
                      <Heading align="center">Current Players</Heading>
                      {usernames.map((username) => (
                        <Text align="center" color="black" size="14" font="default">
                          {username}
                        </Text>
                    ))}
                    </Box>
                </Box>
          </Box>
        ),
        intents: [
          <Button value="checkGame" action= "/checkGame">Refresh</Button>,
          <Button value="rules" action="/"> Rules </Button>,
        ]
      })
    }
  }
  // Case - Round is still active additional click added
  // Check if currClicks will exceed number of targetClicks

  // Need to include set cardinality so if the same user is being added
  // TODO: Add a check to see if the user is already in the list

  let inList = false;
  if(c.frameData?.fid != null){
    // Check if the user is already in the list of clickers 
    inList = await client.sIsMember(roundKey, (c.frameData?.fid).toString());
  }
  if(currClicks + 1 > targetClicks && !inList){
    console.log("Case - Target num exceeded");
    // Start a new round
    initializeGameState(true);
    console.log("after init game, target num exceeded");
    return c.res({
      image: (
        <Box  
          grow
          alignVertical="center"
          backgroundColor="white"
          padding="32"
          backgroundImage={`url(${CRACKING_ICE_IMAGE})`}
          height="100%"
        >
            <Text align="center" color="black" size="20">
              You cracked the ice :/
            </Text>
        </Box>
      ),
      intents: [
        <Button value="rules" action="/"> Rules </Button>,
      ]
    })
  }

  // Case - Round is still active
  if(c.frameData?.fid != null) { 
    // TODO: Consider disallowing a person if they break the game
    console.log("Adding a new user to click list", c.frameData?.fid);
    let currFids = [];
    currFids.push(c.frameData?.fid.toString());
    const currUsername = await getUsernames(currFids);
    console.log("currUsername: ", currUsername);
    try {
      const replies = await client.multi()
        .sAdd(roundKey, (c.frameData?.fid).toString())
        // .sAdd((c.frameData?.fid).toString(), currUsername)
        .sCard(roundKey)
        .exec();
      updatedClicks = replies[1] as number;
    } catch (err) {
      // handle error
      throw err;
    } 
    const usernames = await getCurrentPlayers();
    console.log("usernames: ", usernames);
  }

  const timeRemainingFormatted = getFormattedTimeRemaining();
  let usernames = await getCurrentPlayers();
  return c.res({
    image: (
      <Box
        grow
        alignVertical="center"
        backgroundColor="white"
        padding="32"
        backgroundImage={`url(${MID_GAME_IMAGE})`}
        height="100%"
      >
            <Box alignContent='center' grow flexDirection='column'>
                <Spacer size="16" />
                <Heading align="center">Time Left</Heading>                
                <Text align="center" color="black" size="20">
                  {timeRemainingFormatted}
                </Text>
                <Heading align="center">Spots Taken</Heading>                
                <Text align="center"color="black" size="20">
                   {currClicks} / { targetClicks }
                </Text>
                <Box alignContent='center' grow flexDirection='column'>
                  <Heading align="center">Current Players</Heading>
                  {usernames.map((username) => (
                    <Text align="center" color="black" size="14" font="default">
                      {username}
                    </Text>
                ))}
                </Box>
            </Box>
      </Box>
    ),
    intents: [
      <Button value="checkGame" action= "/checkGame">Refresh</Button>,
      <Button value="rules" action="/"> Rules </Button>,
    ]
  })
});


app.frame('/leaderboard', async (c) => {
  let top10 = await getTop10(); // Assuming getTop10 returns [{ value: 'farcaster', score: 2.1 }, ...]

  return c.res({
      image: (
          <Box
            grow
            alignVertical="center"
            backgroundColor="white"
            padding="32"
            backgroundImage={`url(${MID_GAME_IMAGE})`}
            height="100%"
          >
              <Heading align="center">Leaderboard</Heading>
                {top10.map(player => (
                  <Box flexDirection="row" justifyContent="center" paddingBottom={"1"}>
                      <Text>{player.value}</Text>
                      <Spacer size="16" />
                      <Text>{player.score.toFixed(2)}</Text>
                  </Box>
                ))}
          </Box>
      ),
      intents: [
        <Button action= "/">Rules</Button>
      ]
  });
});

app.frame('/rewards', async(c) => {
  // Display the username and reward for the current user
  const { frameData } = c;
  const { fid } = frameData as unknown as { buttonIndex?: number; fid?: string };

  const responseUserData = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'api_key': process.env.NEYNAR_API_KEY || 'NEYNAR_API_DOCS',
    },
  });

  const data = await responseUserData.json();
  const userData = data.users[0];

  const usernames = userData.username;
  
  // let userScore = 0;
  // try {
  //   userScore = (await client.zScore("userScores", usernames));
  // } catch (e) {}

  let userScore = await client.zScore('userScores', usernames);

  // console.log("userScore: ", userScore);
  // If no rewards show one screen
  // If there are rewards show a different screen
  if(userScore != null && userScore > 0){
    // Show them current reward
    return c.res({
      image: (
        <Box
          grow
          alignVertical="center"
          backgroundColor="white"
          padding="32"
          backgroundImage={`url(${MID_GAME_IMAGE})`}
          height="100%"
        >
            <Spacer size="16" />
            <Heading align="center" >Your Reward</Heading>
            <Spacer size="16" />
              <Text align="center">
                {userScore}
              </Text>
        </Box>
      ),
      intents: [
        <Button action= "/">Rules</Button>
      ]
    });
  }
  return c.res({
    image: (
      <Box
        grow
        alignVertical="center"
        backgroundColor="white"
        padding="32"
        backgroundImage={`url(${MID_GAME_IMAGE})`}
        height="100%"
      > 
          <Spacer size="16" />
          <Heading align="center" >Your Reward</Heading>
          <Spacer size="16" />
              <Text align="center">
                0
              </Text>
      </Box>
    ),
    intents: [
      <Button action= "/">Rules</Button>
    ]
  });
});
// Devtools
// app.use("/", fdk.analyticsMiddleware({ frameId: "Testing", customId: "Test id"}));
// if (import.meta.env?.MODE === 'development') devtools(app, { serveStatic })
//   else devtools(app, { assetsPath: '/.frog' })
devtools(app, { serveStatic })

// Vercel
export const GET = handle(app)
export const POST = handle(app)
