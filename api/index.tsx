import { Button, Frog } from 'frog'
// import { neynar } from 'frog/hubs';
import { handle } from 'frog/vercel';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';

// Redis
import { createClient } from 'redis';
// Frog UI
import { Box, Heading, Text, VStack, Image, vars, HStack, Columns, Divider, Spacer,  } from './ui.js';

const client = createClient({
  password: 'nZUpPOLpXmmeQBTSUL5X3ByDwlPgXE9Y',
  socket: {
      host: 'redis-13192.c326.us-east-1-3.ec2.cloud.redislabs.com',
      port: 13192
  }
});
// client.on('error', err => console.log('Redis Client Error', err));

await client.connect();
// Setup game constraints
const gameDuration = 1 * 60 * 1000;
const gameEndTime = Date.now() + gameDuration;
// const startTargetClicks = Math.floor(Math.random() * 10) + 1;
const startTargetClicks = 1;
const roundKey = "round:clickers";
const baseReward = 1;
let roundReward = baseReward;

client.multi()
  .del(roundKey)
  .set('roundEndTime', gameEndTime.toString())
  .set('targetClicks', startTargetClicks)
  .set('baseReward', baseReward)
  .set('roundReward', roundReward)
  .hSet('winner', 'mane', 10)
  .exec();
// End game setup

// Function to start a new round
// Used after time limit is broken or currClicks exceeds numClicks
async function initializeGameState() {
  // const targetClicks = Math.floor(Math.random() * 10) + 1;
  const targetClicks = 2; 
  // Redis calls to set the state of the game
  client.multi()
    .set('targetClicks', targetClicks)
    .set('roundEndTime', Date.now() + gameDuration)
    .del(roundKey)
    .exec();
}

// Helpers
// Function to format timeRemaining in human readable format, hours:minutes:seconds
function formatTime(timeRemaining: number) {
  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
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
    headers: { accept: 'application/json', api_key: '14575066-A15B-4807-9508-F260E1B2223A' }
  };
  let temp: any = [];
  let allUsernames = [];
  try{
    // Fetch the Username from Fid
    await fetch(usernameUrl + fidsString, neynarOptions)
    .then(res => res.json())
    .then(usernameJson => {
      console.log(usernameJson["users"])
      temp = usernameJson["users"]
    })
    .catch(err => console.error('error:' + err));
    // Loop through temp and creating a new array of "usernames" from temp[i]["username"]
    // looop through temp and only returns the "display_name" from temp[i]["display_name"]    
    for(let i = 0; i < temp.length; i++){
      console.log("temp[i]: ", temp[i]);
      allUsernames.push(temp[i]["username" as any] as string);
    }
  console.log("allUsernames: ", allUsernames);
  } catch (err) {
    console.error('error:' + err);
  }
  
  return allUsernames;
}

// Function to get all the fids of the users who have clicked the button and then return the usernames
async function getCurrentPlayers(){
  // Call to redis to get the current players
  const currFids = await client.sMembers(roundKey);
  console.log("currFids: ", currFids);
  // No users have clicked the button
  if(currFids == null){
    return [];
  }
  console.log("currFids: ", currFids);
  const usernames = await getUsernames(currFids);
  return usernames;
}

// Neynar
// const fetch = require('node-fetch');
// const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY ?? "";

// Utils
export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  ui: { vars },
  browserLocation: "https://swellnetwork.io",
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
})

// Game Vars
// If X number of people click the button with 3 hour time frame
// all people split the pot
const randomNumber = Math.floor(Math.random() * 10) + 1;

app.use('/*', serveStatic({ root: './public' }))
// Default Frame
app.frame('/', (c) =>
  {
  // Other case is we're just getting started
  const { buttonValue, status } = c
  return c.res({
  image: (
    <Box>
      <HStack >
        <Image 
            src= "/first_frame.png"
            height="100%"
          />
          <Box alignContent='center' grow flexDirection='column' fontFamily='madimi' paddingTop="2">
              <Spacer size="16" />
              <Heading align="center" decoration='underline'>Don't Break the Ice</Heading>                
              <Spacer size="16" />
              <Text align="center">
                Click the button to get on the ice
              </Text>
              <Text align="center">
                Too many on the ice 
              </Text>
              <Text align="center">
                and the game restarts
              </Text>
          </Box>
      </HStack>
    </Box>
  ),
  intents: [
          <Button value="grab" action= "/joinTheIce">Click Me</Button>,
          <Button value="checkGame" action= "/checkGame">Check Game</Button>, 
        ],
    })
})

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

  // Get the usernasmes of the people who have clicked the button
  let usernames = await getCurrentPlayers();
  let amountWon = await client.hGet('winner', 'mane');
  console.log("usernames: ", usernames);
  console.log("currClick: ", currClicks);
  console.log("targetClicks: ", targetClicks);
  // TODO: Inlcude a way to show if the user that clicked the button is in the list of current players
  return c.res({
    image: (
      <Box>
        <HStack >
          <Image 
              src= "/mid_game.png"
              height="100%"
            />
            <Box alignContent='center' grow flexDirection='column' fontFamily='madimi' paddingTop="2">
                <Spacer size="16" />
                <Heading align="center">Time Left</Heading>                
                <Text align="center" color="text200" size="20">
                  {timeRemainingFormatted}
                </Text>
                <Heading align="center">Spots Taken</Heading>                
                <Text align="center"color="text200" size="20">
                   {currClicks} / { targetClicks }
                </Text>
                <Box alignContent='center' grow flexDirection='column' fontFamily='madimi' paddingTop="4">
                  <Heading align="center">Current Players</Heading>
                  {usernames.map((username) => (
                    <Text align="center" color="text200" size="14" font="default">
                      {username}
                    </Text>
                ))}
                </Box>
                
            </Box>
        </HStack>
      </Box>
    ),
    intents: [
      <Button value="checkGame" action= "/checkGame">Refresh</Button>,
      <Button value="rules" action="/"> Rules </Button>,
    ]
  })
});

// Used to show the resulting time the button is pressed
app.frame('/joinTheIce', async(c) => {
  // Check if the game is over
  // Check if the game is over
  const gameOver = await client.get('gameOver');
  if(gameOver == 'true') {
    let usernames = await getCurrentPlayers();
    return c.res({
    image: (
      <Box>
        <HStack >
          <Image 
              src= "/mid_game.png"
              height="100%"
            />
            <Box alignContent='center' grow flexDirection='column' fontFamily='madimi' paddingTop="2">
                <Spacer size="16" />
                <Box alignContent='center' grow flexDirection='column' fontFamily='madimi' paddingTop="4">
                  <Heading align="center">Winners</Heading>
                  {usernames.map((username) => (
                    <Text align="center" color="text200" size="14" font="default">
                      {username}
                    </Text>
                ))}
                </Box>
            </Box>
        </HStack>
      </Box>
    ),
      intents: [
        <Button value="checkGame" action= "/checkGame">Refresh</Button>,
        <Button value="rules" action="/"> Rules </Button>,
      ]
    })
  } 
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
    // Case - Game is over
    if(currClicks == targetClicks) {
      // set a variable to true to show the game is over
      await client.set('gameOver', 'true');

      console.log("Case - Game over");
      // TODO: Final Frames to show the users who have clicked the button
      let usernames = await getCurrentPlayers();
      return c.res({
    image: (
      <Box>
        <HStack >
          <Image 
              src= "/mid_game.png"
              height="100%"
            />
            <Box alignContent='center' grow flexDirection='column' fontFamily='madimi' paddingTop="2">
                <Spacer size="16" />
                <Box alignContent='center' grow flexDirection='column' fontFamily='madimi' paddingTop="4">
                  <Heading align="center">Winners</Heading>
                  {usernames.map((username) => (
                    <Text align="center" color="text200" size="14" font="default">
                      {username}
                    </Text>
                ))}
                </Box>
            </Box>
        </HStack>
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
      initializeGameState();
      

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
          <Box>
            <HStack >
              <Image 
                  src= "/mid_game.png"
                  height="100%"
                />
                <Box alignContent='center' grow flexDirection='column' fontFamily='madimi' paddingTop="2">
                    <Spacer size="16" />
                    <Heading align="center">Time Left</Heading>                
                    <Text align="center" color="text200" size="20">
                      {timeRemainingFormatted}
                    </Text>
                    <Heading align="center">Spots Taken</Heading>                
                    <Text align="center"color="text200" size="20">
                       {currClicks} / { targetClicks }
                    </Text>
                    <Box alignContent='center' grow flexDirection='column' fontFamily='madimi' paddingTop="4">
                      <Heading align="center">Current Players</Heading>
                      {usernames.map((username) => (
                        <Text align="center" color="text200" size="14" font="default">
                          {username}
                        </Text>
                    ))}
                    </Box>
                    
                </Box>
            </HStack>
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
    initializeGameState();
    return c.res({
      image: (
        <Box alignContent='center'>
          <HStack>
            <Image 
              // width="100%" 
              height="100%" 
              src="/cracking_ice.png"
            />
            <Text align="center" color="text200" size="20">
              You cracked the ice :/
            </Text>
          </HStack>
          
        </Box>
      )
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
      <Box>
        <HStack >
          <Image 
              src= "/mid_game.png"
              height="100%"
            />
            <Box alignContent='center' grow flexDirection='column' fontFamily='madimi'>
                <Spacer size="16" />
                <Heading align="center">Time Left</Heading>                
                <Text align="center" color="text200" size="20">
                  {timeRemainingFormatted}
                </Text>
                <Heading align="center">Spots Taken</Heading>                
                <Text align="center"color="text200" size="20">
                   {currClicks} / { targetClicks }
                </Text>
                <Box alignContent='center' grow flexDirection='column' fontFamily='madimi'>
                  <Heading align="center">Current Players</Heading>
                  {usernames.map((username) => (
                    <Text align="center" color="text200" size="14" font="default">
                      {username}
                    </Text>
                ))}
                </Box>
                
            </Box>
        </HStack>
      </Box>
    ),
    intents: [
      <Button value="checkGame" action= "/checkGame">Refresh</Button>,
      <Button value="rules" action="/"> Rules </Button>,
    ]
  })
});



// Devtools
// app.use("/", fdk.analyticsMiddleware({ frameId: "Testing", customId: "Test id"}));
// if (import.meta.env?.MODE === 'development') devtools(app, { serveStatic })
//   else devtools(app, { assetsPath: '/.frog' })
devtools(app, { serveStatic })

// Vercel
export const GET = handle(app)
export const POST = handle(app)
