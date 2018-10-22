const readline = require('readline');
const fs = require('fs');
const https = require('https');

const IS_SELECTOR_CAPITALIZED = /^[A-Z]/;
const FULLSTOP_CHAR = '.';
const HASH_CHAR = '#'
const EQUALS_BREAKLINE = '=====================================================================';

// Grab json object from QueToo repo
https.get('https://raw.githubusercontent.com/jdolan/quetoo/master/src/cgame/default/ui/settings/SystemViewController.json', result => {
  if (result.statusCode !== 200) {
    console.log(`Yikes! Failed to get JSON object from QueToo repo, status code ${result.statusCode}`);
    process.exit();
  };
  let data = '';

  result.on('data', chunk => {
    data += chunk;
  });
  
  result.on('end', () => mainLoop(JSON.parse(data)));
});

/**
 * The main REPL for the project
 *
 * @param data the json object we recieved from the server
 *
 * @return exit();
 */
mainLoop = data => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question("Please enter a sequence:  ", sequence => {
    if (sequence === 'quit' || sequence === 'q') {
      return process.exit();
    }
    const selectors = [];
    sequence.split(' ').forEach(selector => {
      const parsedSelector = parseSelectorString(selector);
      parsedSelector.classNames = parsedSelector.classNames.filter((name, index, self) => {
        // remove any duplicate classnames
        return index === self.indexOf(name);
      });
      selectors.push(parsedSelector);
    });
    console.log(EQUALS_BREAKLINE);
    console.log('Printing out matches for:');
    console.log(selectors);
    console.log(EQUALS_BREAKLINE);
    crawlDataTree({data, parsedSequence: selectors[0], fullSequence: selectors});
    console.log(EQUALS_BREAKLINE);
    rl.close();
    mainLoop(data);
  });
};

/**
 * Helper function for matching on nested selectors
 *
 * @param data the sub-tree of the main JSON object we're checking
 * @param selectors the remainder of the sequence we're matching on
 *
 * @return null
 */
const doNestedCrawl = (data, selectors) => {
  if (Array.isArray(selectors) && selectors.length) {
    const {baseClass, classNames, identifier} = selectors[0];
    if ((strCompare(baseClass, null) ? true : strCompare(baseClass, data.class))
      && (strCompare(identifier, null) ? true : strCompare(identifier, data.identifier))) {
      const tempClasses = [...classNames];
      const tempSelectors = [...selectors];
      if (data.classNames !== undefined) {
        data.classNames.forEach(name => {
          if (tempClasses.indexOf(name) > -1) {
            tempClasses.splice(tempClasses.indexOf(name), 1);
          }
        });
      }
      if (!tempClasses.length) {
        tempSelectors.shift();
        if (!tempSelectors.length) {
          console.log(data);
          return;
        }
        // All conditions for this selector have been met, let's continue crawling.
        if (Array.isArray(data.subviews) && data.subviews.length) {
          data.subviews.forEach(view => doNestedCrawl(
            view,
            tempSelectors
          ));
        }

        if (Array.isArray(data.contentView)
          && Array.isArray(data.contentView.subviews)
          && data.contentView.subviews.length) {
          data.contentView.subviews.forEach(view => doNestedCrawl(
            view,
            tempSelectors
          ));
        }
        
        if (data.control) {
          doNestedCrawl(
            data.control,
            tempSelectors
          );
        }
      }
    }
  }
  
  return;
};

/**
 * Primary crawler to traverse the JSON object. Only logs output in cases with no nested selector,
 * in those cases doNestedCrawl() handles output
 *
 * @param data the JSON object we're traversing
 * @param parsedSequence the object containing the sequence we're matching on
 * @param fullSequence the complete sequence obtained from the command line
 *
 * @return null
 */
const crawlDataTree = ({data, parsedSequence: {baseClass, classNames, identifier}, fullSequence}) => {
  // class and identifier selectors are always strings, so we just check to see if they're defined
  // if they are, we need to do some additional work for classNames since they're an array
  // We use bracket reference here since class is a restricted term and can lead to some funny behaviors
  if ((strCompare(baseClass, null) ? true : strCompare(baseClass, data.class))
    && (strCompare(identifier, null) ? true : strCompare(identifier, data.identifier))) {
    const tempClasses = [...classNames];
    const tempSequence = [...fullSequence];
    if (data.classNames !== undefined) {
      data.classNames.forEach(name => {
        if (tempClasses.indexOf(name) > -1) {
          tempClasses.splice(tempClasses.indexOf(name), 1);
        }
      });
    }
    if (!tempClasses.length) {
      // We have no classes to check that weren't present in the data.className
      tempSequence.shift();
      if (!tempSequence.length) {
        // It's a match, and we don't need to do any more
        console.log(data);
      } else {
        // Time to start doing our nested check!
        doNestedCrawl(data, tempSequence);
      }
    }
  }

  if (Array.isArray(data.subviews) && data.subviews.length) {
    data.subviews.forEach(view => crawlDataTree({
      data: view,
      parsedSequence: {
        baseClass,
        classNames,
        identifier
      },
      fullSequence
    }));
  }

  if (Array.isArray(data.contentView)
    && Array.isArray(data.contentView.subviews)
    && data.contentView.subviews.length) {
    data.contentView.subviews.forEach(view => crawlDataTree({
      data: view,
      parsedSequence: {
        baseClass,
        classNames,
        identifier
      },
      fullSequence
    }));
  }
  
  if (data.control) {
    crawlDataTree({
      data: data.control,
      parsedSequence: {
        baseClass,
        classNames,
        identifier
      },
      fullSequence
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