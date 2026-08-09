# WaveSight

A lightweight data-analysis page.

## Usage

Open `/home/runner/work/WaveSight/WaveSight/index.html` in a browser, input numbers, then click **开始分析**.

## Fixed bug

- Invalid tokens / empty items no longer break statistics and are ignored safely.

## Added feature

- Supports commas, spaces, semicolons, and new lines as input separators.
- Adds median calculation in the result panel.

## Test

```bash
cd /home/runner/work/WaveSight/WaveSight
node --test analysis.test.js
```
