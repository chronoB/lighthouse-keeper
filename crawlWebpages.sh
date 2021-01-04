#!/bin/bash
filename='webpages.txt'
n=1
while IFS= read -r line
do
    CLEAN=${line//[^a-zA-Z0-9_.-]/}
    # reading each line
    echo "Line No. $n : $CLEAN"
    n=$((n+1))
    direc="urls/"
    direc+=$CLEAN
    mkdir $direc
    wget -nd --spider --force-html -r -l3 $CLEAN 2>&1 | egrep -o 'https?://[^ ]+' | grep -v '\.\(css\|js\|png\|gif\|jpg\|svg\|xml\|otf\|ttf\|mp3\)$' | grep -v '\(oembed\|\?ver=\|\?v=\|eot\)' | grep '\/$' | sort | uniq > urls/$CLEAN/urls.txt
done < $filename
