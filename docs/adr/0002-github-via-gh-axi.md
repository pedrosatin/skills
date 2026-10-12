# GitHub access in this package goes through gh-axi

pr-loop and pr-description already call gh-axi and read TOON. babysit-prs used gh JSON, so flags and output drifted. One GitHub CLI in the package is the cost of migrating batch merge.
