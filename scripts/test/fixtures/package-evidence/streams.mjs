process.stdout.write("owned π output");
process.stderr.write("owned diagnostic");
process.exitCode = Number(process.argv[2]);
