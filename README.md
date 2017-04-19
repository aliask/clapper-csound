# clapper-csound
A clap detection library for Node.js, using the [Csound](https://csound.github.io) API.
I use it to turn a lamp on and off in my living room in a highly annoying fashion. You can too.

## Installing

This package relies on the Node.js package csound-api, which in turn needs [Boost](http://www.boost.org) 1.53.0 or later, and Csound, of course.

Have a read of the [instructions](https://www.npmjs.com/package/csound-api#installing) over at the csound-api docs.

Once these are installed on your system, you can install this library by running

```sh
npm install clapper-csound
```

## Usage

This package exposes four functions:

`init`, `start`, `stop` and `updateSettings`

Your code should look very similar to this:

```javascript
const clapper = require('clapper-csound');

function trigger() {
  console.log('Doubleclap detected');
}

var settings = {
  debug: true
};

if(clapper.init(trigger, settings)) {
  clapper.start();
}
```

The full settings object looks like this:

```javascript
var settings = {
  debug: false,
  clap: {
    spacing: 0.3,
    rhythmTolerance: 0.1,
    powerThreshold: 0.15
  },
  csound: {
    input: '-iadc'
  }
};
```
