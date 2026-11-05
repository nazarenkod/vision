// The server does not start without its secret key (044), and code that seals or opens a secret
// reads it from the environment, so unit tests run with a throwaway one.
process.env.VISION_SECRET_KEY ??= 'unit-test-secret-key';
// the Jira host the fixtures use ('https://jira'); tests of the allowed list pass their own
process.env.VISION_JIRA_HOSTS ??= 'jira';
