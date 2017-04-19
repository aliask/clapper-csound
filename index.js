const csound = require('csound-api');
const logger = require('js-logger');

var Csound;
var _config = {
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
var lastClap = 0;
var _callback;

/* Handle messages coming in from Csound.
   There are many debug messages, as well as the clap data when Csound hears something.
   We aren't interested in the debug messages (unless --debug is specified), so this
   function will filter these out, and extract clap data and pass along to our clap handler. */
function messageCallback(attributes, string) {

  // Don't log whitespace-only messages
  if(!string.match(/\S/)) {
    return;
  }

  let regex = /Clap! t=(\d+\.\d+) p=(\d+\.\d+)/;
  let clapData = regex.exec(string);

  if(clapData) {
    clapData = { time: clapData[1], power: clapData[2] };
    handleClap(clapData);
  } else {
    if(attributes & csound.MSG_ERROR)
      logger.error(string.trim());
    else if(attributes & csound.MSG_WARNING)
      logger.warn(string.trim());
    else
      logger.debug('cSound: ' + string.trim());
  }
}

/* The Csound 'score' must have a fixed duration, so eventually it stops and needs
   to be restarted. This is handled by the following function, which sets up the
   asynchronous process, restarts when necessary. */
function startListening(Csound) {

  csound.RewindScore(Csound);
  csound.PerformAsync(Csound, (result) => {
    // If we reached the end of the score
    if(result > 0) {
      logger.debug('Restarting csound listener');
      setTimeout(startListening, 0);
    } else {
      logger.debug('Csound stopped');
      csound.Destroy(Csound);
    }
  });

}

/* When Csound detects a clap, it is handled by this function. We determine a doubleclap
   based on the timing data provided, and we can optionally apply a power threshold.
   If the conditions are met, we trigger the callback */
function handleClap(clapInfo) {
  const clapDelta = clapInfo.time - lastClap;

  if(clapInfo.power < _config.clap.powerThreshold) {
    logger.debug('Clap power - ' + clapInfo.power + ' - below power threshold - ' + _config.clap.powerThreshold);
    return;
  }

  logger.debug('Clap detected! Delta: ' + clapDelta);

  if(clapDelta > (_config.clap.spacing - _config.clap.rhythmTolerance) &&
     clapDelta < (_config.clap.spacing + _config.clap.rhythmTolerance)) {

    logger.log('Doubleclap detected - ' + (clapDelta * 1000).toFixed(1) + 'ms spacing');
    _callback();
  }

  lastClap = clapInfo.time;
}

var clapper = {

  init: function(callback, config) {

    if(config)
      Object.assign(_config, config);

    logger.useDefaults({
      defaultLevel: _config.debug ? logger.DEBUG : logger.INFO
    });

    if(!callback || typeof callback !== 'function')
      return logger.error('No callback supplied');

    _callback = callback;

    /* Set up Csound API */
    csound.SetDefaultMessageCallback(messageCallback);
    Csound = csound.Create();
    if(Csound) {
      csound.SetMessageCallback(Csound, messageCallback);
      csound.SetOption(Csound, _config.csound.input);
      csound.SetOption(Csound, '--nosound');
      csound.SetOption(Csound, '-B2048');
      csound.SetOption(Csound, '-b512');
      csound.CompileOrc(Csound, `
        sr = 44100
        ksmps = 128
        nchnls = 1
        0dbfs  = 1

        instr ClapListener

          kLastRms init 0
          kLastAttack init 0
          iRmsDiffThreshold init .1

          aIn in

          ;Clap energy is fairly wideband, but by filtering sub 1.5kHz we 
          ;get rid of a lot of voice energy to avoid false positives 
          aSig butterhp aIn, 1500 ; 1.5kHz high pass filter

          ;Normalize the volume of input
          kRmsOrig rms aSig
          kSmoothingFreq linseg 5, 1, 0.01 ;avoids false positives at start of detection
          kSmoothRms tonek kRmsOrig, kSmoothingFreq
          kSmoothRms max kSmoothRms, 0.001 ;prevent divide by 0
          aNorm = 0.1 * aSig / a(kSmoothRms)

          kRms rms aNorm
          kRmsDiff = kRms - kLastRms

          kTime times
          if (kRmsDiff > iRmsDiffThreshold && kTime - kLastAttack > 0.09) then
            kLastAttack times
            printf "Clap! t=%f p=%f\\n", kTime, kLastAttack, kRmsDiff
          endif

          kLastRms = kRms

        endin
      `);
      csound.ReadScore(Csound, `
        i "ClapListener" 0 65535
        e
      `);
      csound.SetDebug(Csound, _config.debug);
      return true;
    } else {
      return false;
    }
  },

  start: function() {
    const status = csound.Start(Csound);
    if(status === csound.SUCCESS) {
      logger.info('Started cSound');
      startListening(Csound);
      return true;
    } else {
      logger.error('Couldn\'t start cSound: is the soundcard locked?');
      csound.Destroy(Csound);
      Csound = 0;
      return false;
    }
  },

  stop: function() {
    csound.Stop(Csound);
  },

  updateConfig: function(config) {
    if(config)
      Object.assign(_config, config);
  }

};

module.exports = clapper;
