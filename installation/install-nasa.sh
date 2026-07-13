#!/bin/bash
echo "Install NASA EDGE webapp..."
pwd=$PWD
app_home="$(dirname "$pwd")"

#create upload/log/projects/public directories, skip this step for reinstallation
io_home=$app_home/io
if [ ! -d  $io_home ]; then
  echo "Create directories"
  mkdir ${io_home}
  dirs=(
    "upload"
    "upload/files"
    "upload/tmp" 
    "log"
    "projects"
    "public"
    "sra"
    "db"
    "bulksubmissions"
    "tmp"
    "execution_reports"
  )

  for dir in "${dirs[@]}"
  do
    mkdir ${io_home}/${dir}
  done

  test_data_home=$app_home/workflows/test_data
  if [ -d  $test_data_home ]; then
    ln -s ${test_data_home} ${io_home}/public/test_data
  fi
fi

echo "Setup NASA EDGE webapp ..."
#install client
echo "install client..."
cd $app_home/webapp/client
npm install --legacy-peer-deps
npm run build
#install server
echo "install server..."
cd $app_home/webapp/server
npm install

echo "NASA EDGE webapp successfully installed!"
echo "Next steps:"
echo "1. start MongoDB if it's not started yet"
echo "2. start the webapp in EDGE's root directory: pm2 start pm2.config.js"
