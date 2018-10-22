# Cantina REPL project
Usage: `~\>node cantina_project.js`

There are a couple of assumptions made about input that are necessary for the user to know  in order to get the most out of this tool.

1.) Classes are *always* expected to be the first facet in a sequence; The only means we have of identifying them purely from the command line are by checking to see if the facet is in PascalCase (checking if the first letter is capitalized). If we assumed any capital letter in the sequence signified the start of a new class, we'd get false positives on classNames like `.accessoryView`. You may start your sequence with any type of facet, but if a Class is not detected first then it is assumed 
there will not be one.

2.) There can be no more than one Class or Identifier in a given sequence; Classes must be unique for the reasons mentioned above, and identifiers are expected to, well, identify. There are no instances in the JSON object where there are multiple Classes or Identifiers on a specific object, so this shouldn't be an issue.

3.) classNames can be chained indefinitely (`.facetA.facetB.facetC`) but any duplicate classNames in a particular sequence will be deleted. Searching for classNames that are nested inside a view with that same className works fine though (`StackView .container.column .container`).
