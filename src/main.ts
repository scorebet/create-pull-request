import * as core from '@actions/core'
import * as exec from '@actions/exec'
import {isDocker} from './isDocker'
import {setupPython} from './setupPython'
import {
  ConfigOption,
  getRepoPath,
  getAndUnsetConfigOption,
  addConfigOption
} from './git'
import {inspect} from 'util'

const EXTRAHEADER_OPTION = 'http.https://github.com/.extraheader'
const EXTRAHEADER_VALUE_REGEX = '^AUTHORIZATION:'

async function run(): Promise<void> {
  let repoPath
  let extraHeaderOption = new ConfigOption()
  try {
    // Python assets
    const cpr = `${__dirname}/cpr`
    core.debug(`cpr: ${cpr}`)

    // Determine how to access python and pip
    const {pip, python} = (function (): {pip: string; python: string} {
      if (isDocker()) {
        core.info('Running inside a Docker container')
        // Python 3 assumed to be installed and on the PATH
        return {
          pip: 'pip3',
          python: 'python3'
        }
      } else {
        // Setup Python from the tool cache
        setupPython('3.x', 'x64')
        return {
          pip: 'pip',
          python: 'python'
        }
      }
    })()

    // Install requirements
    await exec.exec(pip, [
      'install',
      '--requirement',
      `${cpr}/requirements.txt`,
      '--no-index',
      `--find-links=${__dirname}/vendor`
    ])

    // Fetch action inputs
    const inputs = {
      token: core.getInput('token'),
      path: core.getInput('path'),
      commitMessage: core.getInput('commit-message'),
      committer: core.getInput('committer'),
      author: core.getInput('author'),
      title: core.getInput('title'),
      body: core.getInput('body'),
      labels: core.getInput('labels'),
      assignees: core.getInput('assignees'),
      reviewers: core.getInput('reviewers'),
      teamReviewers: core.getInput('team-reviewers'),
      milestone: core.getInput('milestone'),
      project: core.getInput('project'),
      projectColumn: core.getInput('project-column'),
      draft: core.getInput('draft'),
      branch: core.getInput('branch'),
      requestToParent: core.getInput('request-to-parent'),
      base: core.getInput('base'),
      branchSuffix: core.getInput('branch-suffix')
    }
    core.debug(`Inputs: ${inspect(inputs)}`)

    // Set environment variables from inputs.
    if (inputs.token) process.env.GITHUB_TOKEN = inputs.token
    if (inputs.path) process.env.CPR_PATH = inputs.path
    if (inputs.commitMessage)
      process.env.CPR_COMMIT_MESSAGE = inputs.commitMessage
    if (inputs.committer) process.env.CPR_COMMITTER = inputs.committer
    if (inputs.author) process.env.CPR_AUTHOR = inputs.author
    if (inputs.title) process.env.CPR_TITLE = inputs.title
    if (inputs.body) process.env.CPR_BODY = inputs.body
    if (inputs.labels) process.env.CPR_LABELS = inputs.labels
    if (inputs.assignees) process.env.CPR_ASSIGNEES = inputs.assignees
    if (inputs.reviewers) process.env.CPR_REVIEWERS = inputs.reviewers
    if (inputs.teamReviewers)
      process.env.CPR_TEAM_REVIEWERS = inputs.teamReviewers
    if (inputs.milestone) process.env.CPR_MILESTONE = inputs.milestone
    if (inputs.project) process.env.CPR_PROJECT_NAME = inputs.project
    if (inputs.projectColumn)
      process.env.CPR_PROJECT_COLUMN_NAME = inputs.projectColumn
    if (inputs.draft) process.env.CPR_DRAFT = inputs.draft
    if (inputs.branch) process.env.CPR_BRANCH = inputs.branch
    if (inputs.requestToParent)
      process.env.CPR_REQUEST_TO_PARENT = inputs.requestToParent
    if (inputs.base) process.env.CPR_BASE = inputs.base
    if (inputs.branchSuffix) process.env.CPR_BRANCH_SUFFIX = inputs.branchSuffix

    // Get the repository path
    repoPath = getRepoPath(inputs.path)
    // Get the extraheader config option if it exists
    extraHeaderOption = await getAndUnsetConfigOption(
      repoPath,
      EXTRAHEADER_OPTION,
      EXTRAHEADER_VALUE_REGEX
    )

    // Execute create pull request
    await exec.exec(python, [`${cpr}/create_pull_request.py`])
  } catch (error) {
    core.setFailed(error.message)
  } finally {
    // Restore the extraheader config option
    if (extraHeaderOption.value != '') {
      if (
        await addConfigOption(
          repoPath,
          EXTRAHEADER_OPTION,
          extraHeaderOption.value
        )
      )
        core.debug(`Restored config option '${EXTRAHEADER_OPTION}'`)
    }
  }
}

run()
