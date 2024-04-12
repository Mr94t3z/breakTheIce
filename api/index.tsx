import { Button, Frog } from 'frog'
// import { neynar } from 'frog/hubs';
import { handle } from 'frog/vercel';
// import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';

// Redis
import { createClient } from 'redis';

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
const startTargetClicks = Math.floor(Math.random() * 10) + 1;
const roundKey = "round:clickers";

client.multi()
  .del(roundKey)
  .set('roundEndTime', gameEndTime.toString())
  .set('targetClicks', startTargetClicks)
  .exec();
// End game setup

// Function to start a new round
// Used after time limit is broken or currClicks exceeds numClicks
async function initializeGameState() {
  const targetClicks = Math.floor(Math.random() * 10) + 1;
  // const roundEndTime = Date.now() + gameDuration;

  // Redis calls to set the state of the game
  client.multi()
    .set('targetClicks', targetClicks)
    .set('roundEndtime', Date.now() + gameDuration)
    .del(roundKey)
    .exec();
  // await client.set('targetClicks', targetClicks);
  // await client.set('roundEndTime', roundEndTime);
  // await client.del(roundKey);
}

// Neynar
// const fetch = require('node-fetch');
// const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY ?? "";

// Frame Analytics
// const fdk = new PinataFDK({
//   pinata_jwt: process.env.PINATA_JWT as string,
//   pinata_gateway: "orange-worrying-impala-198.mypinata.cloud"}, 
// );

// Utils
export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
})

// Game Conditions
// If X number of people click the button with 3 hour time frame
// all people split the pot
const randomNumber = Math.floor(Math.random() * 10) + 1;

app.use('/*', serveStatic({ root: './public' }))
// Default Frame
app.frame('/', (c) =>
  {
  // Other case is we're just getting started
  const { buttonValue, status } = c
  const fruit = buttonValue
  
  return c.res({
    action: '/time',
    image: (
      <div
        style={{
          alignItems: 'center',
          background:
            status === 'response'
              ? 'linear-gradient(to right, #432889, #17101F)'
              : 'black',
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 30,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {status === 'response'
            ? `Nice choice.${fruit ? ` ${fruit.toUpperCase()}!!` : ''}`
            : 'Welcome!'}
        </div>
      </div>
    ),
    intents: [
      <Button value="apples">Click Me</Button>,
      <Button.Transaction target="/transfer">Test</Button.Transaction>,
      status === 'response' && <Button.Reset>Reset</Button.Reset>,
    ],
  })
})

// Used to show the resulting time the button is pressed
app.frame('/time', async(c) => {
  // Do game checks to see if it is over or not
  // Case - Curr Time > End Time
  const roundEndTime = parseInt(await client.get("roundEndTime") as string, 10);
  // Case - Clicks > Target Clicks
  const currClicks = Number(await client.sCard(roundKey));
  const targetClicks = Number(await client.get('targetClicks'));
  console.log("currClick: ", currClicks);
  console.log("targetClicks: ", targetClicks);
  // Case - round is over already
  // Check to see if the game is over or just the round
  if(Date.now() > roundEndTime){
    // Case - Game is over
    if(currClicks == targetClicks) {
      console.log("Case - Game over");
      // TODO: Show the users who have clicked the button
      // TOIDO: Consider using FrogUI to gen image
      return c.res({
        image: (
          <div style={{ color: 'white', display: 'flex', fontSize: 60 }}>
            { "Game is over, congrats to the winners" }
          </div>
        )
      })
    } else { 
      console.log("Case - Time expired, start new round");
      // Case - Round is over
      // Setup and start a new round
      initializeGameState();
      return c.res({
        image: (
          <div style={{ color: 'white', display: 'flex', fontSize: 60 }}>
            { "New round started"}
          </div>
        )
      })
    }
  }
  // Case - Round is still active additional click added
  // Check if currClicks will exceed number of targetClicks

  // Need to include set cardinality so if the same user is being added
  if(currClicks + 1 > targetClicks){
    console.log("Case - Target num exceeded");
    // Start a new round
    initializeGameState();
    return c.res({
      image: (
        <div style={{ color: 'white', display: 'flex', fontSize: 60 }}>
          { "You ruined it for everyone"}
        </div>
      )
    })
  }

  // Case - Nice, the game goes on
  // Used for fetching Farcaster username
  // const usernameUrl = 'https://api.neynar.com/v2/farcaster/user/bulk?fids=';
  // TODO - api key from env
  // const neynarOptions = {
  //   method: 'GET',
  //   headers: { accept: 'application/json', api_key: '14575066-A15B-4807-9508-F260E1B2223A' }
  // };
  
  // Case - Round is still active
  let temp = 0;
  if(c.frameData?.fid != null && c.frameData?.address != null){
    // Need to get the username of the person now
    // Should regulary here
  } else if(c.frameData?.fid != null){
    // TODO: Consider disallowing a person if they break the game
    console.log("Adding a new user to click list");
    try {
      const replies = await client.multi()
        .sAdd(roundKey, (c.frameData?.fid).toString())
        .sCard(roundKey)
        .exec();
      temp = replies[1];
    } catch (err) {
      // handle error
      throw err;
    }
    await client.sAdd(roundKey, (c.frameData?.fid).toString());
    temp = await client.sCard(roundKey);
    // Fetch the Username from Fid
    // await fetch(usernameUrl + (c.frameData?.fid).toString(), neynarOptions)
    //   .then(res => res.json())
    //   .then(usernameJson => {
    //     console.log(usernameJson["users"][0]["display_name"])
    //     temp = usernameJson["users"][0]["display_name"]
    //   })
    //   .catch(err => console.error('error:' + err));
  }

  return c.res({
    image: (
      <div style={{ color: 'white', display: 'flex', fontSize: 60 }}>
        { "Button pushed by " + c.frameData?.fid + " currently " + temp + "/" + targetClicks}
      </div>
    )
  })
});

// Devtools
// app.use("/", fdk.analyticsMiddleware({ frameId: "Testing", customId: "Test id"}));
// if (import.meta.env?.MODE === 'development') devtools(app, { serveStatic })
//   else devtools(app, { assetsPath: '/.frog' })
// devtools(app, { serveStatic })

// Vercel
export const GET = handle(app)
export const POST = handle(app)
