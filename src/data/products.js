const assetRoot = `${import.meta.env.BASE_URL}SIGNLINK_3D_Concepts_v2`;

export const products = [
  {
    key: 'Smart',
    name: 'SIGNLINK Smart',
    shortLabel: 'Everyday companion',
    className: 'product-smart',
    accent: '#6aa8ff',
    target: 'General users',
    description:
      'An AI smart glasses concept for everyday help through voice, camera understanding, translation, and hands-free capture.',
    features: [
      'AI personal companion',
      'Voice interaction',
      'Scene understanding',
      'Language translation',
      'Hands-free photo and video capture',
    ],
    image: `${assetRoot}/previews/SIGNLINK_Smart_Assembled.png`,
    useCaseIntro: 'A hands-free companion for the moments when pulling out a phone is awkward.',
    useCases: [
      'Ask a question out loud and hear an answer.',
      'Have a scene, sign, or menu explained.',
      'Translate speech between languages.',
      'Capture photos and video without touching a screen.',
    ],
    comparison: {
      primary: 'Voice assistant, scene understanding, translation, and hands-free capture',
      display: 'None. Audio-first concept.',
      cameras: 'One wide-angle camera concept',
      audio: 'Open-ear speakers and three microphone ports',
    },
  },
  {
    key: 'Connect',
    name: 'SIGNLINK Connect',
    shortLabel: 'Communication companion',
    className: 'product-connect',
    accent: '#2fd6c9',
    target: 'Deaf and hard-of-hearing people',
    description:
      'An AR smart glasses concept designed to support communication between sign-language users and spoken-language users. Hearing and blind people can participate as communication partners without wearing the device.',
    features: [
      'Real-time speech-to-text captions',
      'Speech-to-sign representation',
      'Sign-language recognition',
      'Sign-to-text and sign-to-voice translation',
      'Selectable text, sign, or combined output',
    ],
    image: `${assetRoot}/previews/SIGNLINK_Connect_Assembled.png`,
    useCaseIntro:
      'Designed to ease conversation between sign-language users and people who speak. Hearing and blind people can participate as communication partners without wearing the device.',
    useCases: [
      'See live captions of nearby speech.',
      'View speech as a sign-language representation.',
      'Convert the wearer’s signing to text or synthesized voice.',
      'Choose text, sign, or combined output.',
    ],
    comparison: {
      primary: 'Captions, speech-to-sign, sign recognition, sign-to-text, and sign-to-voice',
      display: 'AR waveguide and microdisplay projector (concept)',
      cameras: 'Front sign-recognition camera and downward wearer hand-sign camera',
      audio: 'Open-ear speakers and two speech-capture microphone ports',
    },
  },
  {
    key: 'Vision',
    name: 'SIGNLINK Vision',
    shortLabel: 'Visual companion',
    className: 'product-vision',
    accent: '#ffa23a',
    target: 'Blind and low-vision people',
    description:
      'A visual assistance smart glasses concept designed to describe surroundings through audio and voice questions.',
    features: [
      'AI Visual Companion',
      'Live scene descriptions',
      'Voice-based questions',
      'Image and video explanations',
      'Concise descriptions, with more detail on request',
      'Basic environmental hazard awareness alerts',
    ],
    image: `${assetRoot}/previews/SIGNLINK_Vision_Assembled.png`,
    useCaseIntro: 'Designed to describe surroundings through audio and answer spoken questions.',
    useCases: [
      'Hear short scene descriptions by default, with more detail on request.',
      'Ask what is in front of you.',
      'Have photos and video explained aloud.',
      'Receive basic alerts for some supported potential hazards.',
    ],
    comparison: {
      primary: 'Scene descriptions, spoken Q&A, image and video explanations, and basic hazard awareness',
      display: 'None. Audio and haptic feedback concepts.',
      cameras: 'Wide-angle and stereo cameras, plus optional Time-of-Flight depth sensor',
      audio: 'Open-ear speakers, three microphone ports, and optional haptic motor',
    },
  },
];

export const technology = [
  {
    title: 'Artificial intelligence',
    description:
      'An assistant layer that understands requests, summarizes what it sees and hears, and answers in plain language.',
  },
  {
    title: 'Computer vision',
    description:
      'Cameras feed software that identifies scenes, objects, and text so they can be described or acted on.',
  },
  {
    title: 'Speech recognition',
    description: 'Microphone arrays pick up nearby speech so it can be turned into text or commands.',
  },
  {
    title: 'Sign-language recognition',
    description:
      'Designed to read hand shapes and movement from two cameras. Accuracy and language coverage are open research questions.',
  },
  {
    title: 'Augmented reality',
    description:
      'In Connect, a waveguide display is intended to place captions and sign output in the wearer’s view.',
  },
  {
    title: 'Wearable electronics',
    description:
      'Battery, control boards, and USB-C charging are arranged inside slim temples. Packaging is illustrative only.',
  },
  {
    title: 'Audio assistance',
    description:
      'Open-ear speakers are designed to deliver spoken answers while keeping surroundings audible.',
  },
];
