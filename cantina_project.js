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
    const selectors = selector.split(' ');
    selectors.forEach(sequence => {
      const parsedSequence = parseSelectorString(sequence);
      parsedSequence.classNames = parsedSequence.classNames.filter((name, index, self) => {
        // remove any duplicate classnames
        return index === self.indexOf(name);
      });
      crawlDataTree(({data, parsedSequence}));
    });
    rl.close();
    mainLoop(data);
  });
};

/**
 * Helper function to traverse the JSON object and log any objects that match our parameters
 *
 * @param data the JSON object we're traversing
 * @param sequence the object containing the sequence we're matching on
 *
 * @return null
 */
const crawlDataTree = ({data, parsedSequence: {baseClass, classNames, identifier}}) => {
  // class and identifier selectors are always strings, so we just check to see if they're defined
  // if they are, we need to do some additional work for classNames since they're an array
  // We use bracket reference here since class is a restricted term and can lead to some funny behaviors
  if ((strCompare(baseClass, null) ? true : strCompare(baseClass, data.class))
    && (strCompare(identifier, null) ? true : strCompare(identifier, data.identifier))) {
    const tempClasses = [...classNames];
    if (data.classNames !== undefined) {
      data.classNames.forEach(name => {
        if (tempClasses.indexOf(name) > -1) {
          tempClasses.splice(tempClasses.indexOf(name), 1);
        }
      });
    }
    if (tempClasses.length < 1) {
      // We have no classes to check that weren't present in the data.className
      console.log(data);
    }
  }

  if (data.subviews !== undefined && data.subviews.length > 0) {
    data.subviews.forEach(view => crawlDataTree({
      data: view,
      parsedSequence: {
        baseClass,
        classNames,
        identifier
      }
    }));
  }

  if (data.contentView !== undefined && data.contentView.subviews !== undefined && data.contentView.subviews.length > 0) {
    data.contentView.subviews.forEach(view => crawlDataTree({
      data: view,
      parsedSequence: {
        baseClass,
        classNames,
        identifier
      }
    }));
  }
  
  if (data.control !== undefined) {
    crawlDataTree({
      data: data.control,
      parsedSequence: {
        baseClass,
        classNames,
        identifier
      }
    });
  }
  return;
}


/**
 * Helper function to compare the values of two variables of varying types when cast to string
 *
 * @param str1 the first variable we're casting to string
 * @param str2 the second variable we're casting to string
 *
 * @return bool are the two stringified variables equal?
 */
const strCompare = (str1, str2) => {
  if (str1 === undefined || str1 === null) {
    return str2 === undefined || str2 === null;
  } else if (str2 === undefined || str2 === null) {
    return false;
  }
  return str1.toString() === str2.toString();
}

/**
 * Helper function to turn a sequence string from the command line into a structured selector object
 *
 * @param selectorString the sequence needing to be parsed
 *
 * @return object the parsed properties of the sequence string
 */
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




















