# Controller action

This directory is reserved for the controller action's `action.yml` and packaging. Add them with the
executable controller, not as an action that succeeds without doing work.

The action must run the controller from the selected Upkeep release independently of the consuming
dependency checkout. Runtime dependencies and prompt files must be available without installing into
the consumer's project.
