import type { Place } from '@/types';

export const mockPlaces: Place[] = [
  {
    id: 'iloilo-river-esplanade',
    name: 'Iloilo River Esplanade',
    address: 'Iloilo City, Iloilo',
    category: 'Riverfront Walk',
    description: 'A breezy waterfront promenade where sunrise joggers, evening strollers, and café lovers gather under the city lights.',
    memoryCount: 12,
    moods: ['Calm', 'Energetic', 'Colorful'],
    memories: [
      { id: 'm1', title: 'Sunrise Run', author: 'Ari', note: 'The river looked like it was painted in soft gold. I stopped for a photo at the bridge.', tag: 'Morning' },
      { id: 'm2', title: 'Evening Glow', author: 'Mika', note: 'The promenade felt cinematic after sunset; families gathered and the whole city softened.', tag: 'Evening' },
      { id: 'm3', title: 'Sketch and Savor', author: 'Jules', note: 'I sketched the skyline while sipping coffee from a nearby stall.', tag: 'Creative' },
    ],
    museum: {
      livingExhibit: 'A riverside tableau of morning light, local food, and shared community rituals.',
      placeMood: 'Reflective, breezy, and luminous with gentle city energy.',
      memoryWallSummary: 'Visitors remember the Esplanade as a place where Iloilo slows down and opens up.',
      voiceTourScript: [
        'Welcome to the Iloilo River Esplanade, where the city meets the water in a series of calm, glowing moments.',
        'Look for the bridge silhouettes at dusk and the soft movement of people on their evening walks.',
        'This place is remembered as a shared ritual of rest, reflection, and local charm.',
      ],
      visitorTips: ['Go before 8 a.m. for cooler air and softer light.', 'Bring a simple snack and a small camera for the skyline.', 'Use the benches to watch the river and listen to the city wake up.'],
      miniQuest: {
        title: 'Golden Hour Challenge',
        prompt: 'Find the best spot to watch the sun touch the water and note one color you see.',
        reward: 'A digital stamp for your museum passport.',
      },
      sourcesUsed: ['Community memory notes', 'Local walking guide', 'Riverfront photo references'],
    },
  },
  {
    id: 'molo-mansion',
    name: 'Molo Mansion',
    address: 'Molo, Iloilo City',
    category: 'Heritage House',
    description: 'A stately landmark with old-world details, carved interiors, and stories preserved in every room.',
    memoryCount: 9,
    moods: ['Historic', 'Romantic', 'Spiritual'],
    memories: [
      { id: 'm4', title: 'Grand Entrance', author: 'Lia', note: 'The facade felt like a secret stage set from a classic movie.', tag: 'Architecture' },
      { id: 'm5', title: 'Quiet Hallway', author: 'Renz', note: 'I loved how still it felt, even with the city outside.', tag: 'Reflection' },
      { id: 'm6', title: 'Old Stories', author: 'Cam', note: 'Every corner made me imagine family portraits and long conversations.', tag: 'Heritage' },
    ],
    museum: {
      livingExhibit: 'An old house preserved as a living archive of heritage, atmosphere, and intimate memory.',
      placeMood: 'Elegant, intimate, and quietly dramatic.',
      memoryWallSummary: 'Guests describe Molo Mansion as a place where history feels close enough to touch.',
      voiceTourScript: [
        'Step into Molo Mansion, where the past is framed by carved details and atmospheric rooms.',
        'Listen for the stories of home, family, and tradition that linger in the architecture.',
        'This museum experience invites you to imagine how lives once moved through these halls.',
      ],
      visitorTips: ['Take your time in the hallways; the smallest details matter.', 'Visit during soft daylight for richer textures.', 'Bring a notebook if you enjoy sketching old architecture.'],
      miniQuest: {
        title: 'Detail Detective',
        prompt: 'Find one decorative detail that feels most like a story waiting to be told.',
        reward: 'A heritage clue unlocked in the museum map.',
      },
      sourcesUsed: ['Heritage notes', 'Historic photographs', 'Local preservation references'],
    },
  },
  {
    id: 'jaro-cathedral',
    name: 'Jaro Cathedral',
    address: 'Jaro, Iloilo City',
    category: 'Religious Landmark',
    description: 'A spiritual landmark with grand religious architecture and a calm, reverent atmosphere.',
    memoryCount: 10,
    moods: ['Spiritual', 'Historic', 'Calm'],
    memories: [
      { id: 'm7', title: 'Peaceful Silence', author: 'Nina', note: 'The feeling inside was soothing and clear, like the city outside had paused.', tag: 'Reflection' },
      { id: 'm8', title: 'Golden Hour Light', author: 'Theo', note: 'The sunlight on the facade looked almost ceremonial.', tag: 'Photography' },
      { id: 'm9', title: 'Faith and Memory', author: 'Aly', note: 'It reminded me that places can carry both history and comfort.', tag: 'Faith' },
    ],
    museum: {
      livingExhibit: 'A sanctuary of sacred light, community faith, and enduring local identity.',
      placeMood: 'Peaceful, solemn, and deeply rooted in tradition.',
      memoryWallSummary: 'Visitors remember Jaro Cathedral as a place where time slows and reflection becomes possible.',
      voiceTourScript: [
        'Welcome to Jaro Cathedral, a landmark shaped by devotion, ceremony, and local memory.',
        'Notice how the architecture balances grandeur with quiet dignity.',
        'This exhibit asks you to feel the rhythm of faith that still lives here.',
      ],
      visitorTips: ['Dress respectfully and keep voices low inside.', 'Visit in the late afternoon for softer natural light.', 'Allow a few minutes to sit and observe the space quietly.'],
      miniQuest: {
        title: 'Sacred Silence',
        prompt: 'Pause for one minute and record one emotion the space evokes in you.',
        reward: 'A reflection badge for your museum archive.',
      },
      sourcesUsed: ['Faith community recollections', 'Architectural notes', 'Cultural heritage references'],
    },
  },
  {
    id: 'calle-real',
    name: 'Calle Real',
    address: 'Iloilo City Proper',
    category: 'Historic Street',
    description: 'A heritage street of old storefronts, vintage character, and small-town energy waiting to be rediscovered.',
    memoryCount: 8,
    moods: ['Historic', 'Colorful', 'Energetic'],
    memories: [
      { id: 'm10', title: 'Street Stories', author: 'Kiko', note: 'The whole street felt alive with old architecture and everyday conversations.', tag: 'Urban' },
      { id: 'm11', title: 'Window Shopping', author: 'Ava', note: 'I loved the mix of old buildings and current shops.', tag: 'Discovery' },
      { id: 'm12', title: 'Vintage Charm', author: 'Drew', note: 'Calle Real has a quiet confidence that makes you want to walk slowly.', tag: 'Heritage' },
    ],
    museum: {
      livingExhibit: 'A living streetscape where heritage storefronts meet present-day city life.',
      placeMood: 'Warm, historic, and slightly playful with creative energy.',
      memoryWallSummary: 'This street is remembered as a blend of old Iloilo charm and everyday discovery.',
      voiceTourScript: [
        'This is Calle Real, where Iloilo’s past and present share the same pavement.',
        'Observe the storefronts, architecture, and local rhythm that make this street distinct.',
        'The museum guide invites you to imagine how commerce, memory, and culture have shaped this corridor.',
      ],
      visitorTips: ['Walk slowly to notice the layered details.', 'Visit in the morning to enjoy fewer crowds.', 'Pause at a café and watch the street come alive.'],
      miniQuest: {
        title: 'Street Snapshot',
        prompt: 'Choose one storefront and describe what makes it memorable to you.',
        reward: 'A street-style collectible card for your archive.',
      },
      sourcesUsed: ['Old street maps', 'Storefront interviews', 'Urban heritage notes'],
    },
  },
];

export const featuredPlace = mockPlaces[0];
