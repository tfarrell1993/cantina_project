const readline = require('readline');
const fs = require('fs');
const https = require('https');

const IS_SELECTOR_CAPITALIZED = /^[A-Z]/;
const FULLSTOP_CHAR = '.';
const HASH_CHAR = '#'

// Grab json object from QueToo repo
https.get('https://raw.githubusercontent.com/jdolan/quetoo/master/src/cgame/default/ui/settings/SystemViewController.json', result => {
  let data = '';

  result.on('data', chunk => {
    data += chunk;
  });
  
  result.on('end', () => mainLoop(JSON.parse(data)));
});

mainLoop = data => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question("Please enter a selector:  ", selector => {
    if (selector === 'quit' || selector === 'q') {
      return process.exit();
    }
    const selectors = parseSelectorString(selector);
    
    console.log(selectors);
    rl.close();
    mainLoop(data);
  });
};

const parseSelectorString = selectorString => {
  if (!selectorString) {
    return {};
  }
  
  let attributes = {
    baseClass: null,
    classNames: [],
    identifier: null
  };
  
  // We start out by figuring out where to cut off the first simple selector
  // The logic here is: if the hash index is less than the fullstop index,
  // the first terminating character is a hash and so we should use that index.
  // If the reverse is the case, then we want to use the fullstop location instead.
  // The only scenario where the two values can be equal is if neither a hash or
  // a fullstop are found anywhere in the string, so we use the entire string.
  const hashLocation = selectorString.indexOf(HASH_CHAR);
  const fullStopLocation = selectorString.indexOf(FULLSTOP_CHAR);
  let subStrIndex = fullStopLocation < hashLocation
    ? fullStopLocation > 0
      ? fullStopLocation
      : hashLocation > 0
        ? hashLocation
        : selectorString.length
    : hashLocation > 0
      ? hashLocation
      : fullStopLocation > 0
        ? fullStopLocation
        : selectorString.length;

  // Now we determine what type of simple selector we have, and what to do with it
  switch(true) {
    case IS_SELECTOR_CAPITALIZED.test(selectorString):
      const classSubstr = selectorString.substring(0, (subStrIndex > 0 ? subStrIndex : selectorString.length));
      attributes.baseClass = classSubstr;
      break;
      
    case selectorString[0] === FULLSTOP_CHAR:
      // We are a className
      if (selectorString.indexOf(FULLSTOP_CHAR) || selectorString.indexOf(HASH_CHAR)) {
        // Give us the substring from the start of the string to the first delineating character we run into
        // We have to be careful to avoid misleading values here, in the case of multiple classNames in a row
        // So, let's pop off the leading character and re-check that index
        const selectorSubstr = selectorString.substring(1, selectorString.length);
        let classNameSubstr = '';
        if (selectorSubstr.indexOf(FULLSTOP_CHAR) > -1) {
          // Shoot, we've gotta recalculate the cutoff index
          subStrIndex = selectorSubstr.indexOf(FULLSTOP_CHAR) < selectorSubstr.indexOf(HASH_CHAR)
            ? selectorSubstr.indexOf(FULLSTOP_CHAR)
            : selectorSubstr.indexOf(HASH_CHAR) > 0
              ? selectorSubstr.indexOf(HASH_CHAR)
              : selectorSubstr.indexOf(FULLSTOP_CHAR);
          
          classNameSubstr = selectorSubstr.substring(0, subStrIndex);
        } else {
          // We're in the clear!
          classNameSubstr = selectorSubstr.substring(0, (subStrIndex > 0 ? subStrIndex - 1: selectorSubstr.length));
        }
        if (!attributes.classNames.includes(classNameSubstr)) {
          attributes.classNames.push(classNameSubstr);
        }
      }
      break;

    case selectorString[0] === HASH_CHAR:
      // We are an identifier
      const identifierSubstr = selectorString.substring(1, subStrIndex > 0 ? subStrIndex : selectorString.length);
      attributes.identifier = identifierSubstr;
      break;
  }
  
  const selectorRest = selectorString.substring(subStrIndex, selectorString.length);
  const {classNames, identifier} = parseSelectorString(selectorRest);
  attributes.classNames = (classNames === undefined || classNames.length < 1) ? attributes.classNames : attributes.classNames.concat(classNames);
  attributes.identifier = identifier || attributes.identifier;
  
  return attributes;
};




















