// Note: first item will be the default value in DB
const projectStatus = [
  'in queue',
  'running',
  'failed',
  'delete',
  'rerun',
  'interrupted',
  'complete',
  'processing',
  'submitted',
]
const uploadStatus = ['live', 'delete']
const jobStatus = ['Submitted', 'Running', 'Failed', 'Aborted', 'Succeeded']
// 'local' is the PID-tracked execution mode; 'runner' covers any job delegated
// to a job-runner service (the specific service is in Job.runner).
const queueTypes = ['local', 'runner', 'cromwell', 'nextflow']
const bulkSubmissionStatus = [
  'in queue',
  'running',
  'failed',
  'delete',
  'rerun',
  'interrupted',
  'complete',
  'processing',
  'submitted',
]

module.exports = {
  projectStatus,
  uploadStatus,
  jobStatus,
  queueTypes,
  bulkSubmissionStatus,
}
