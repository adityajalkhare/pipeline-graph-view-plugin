package io.jenkins.plugins.pipelinegraphview.consoleview;

import hudson.Extension;

/**
 * Built-in {@link ConsoleSectionRule} implementations for common CI tool output.
 */
public final class BuiltInConsoleSectionRules {

    private BuiltInConsoleSectionRules() {}

    @Extension
    public static class MavenPhaseRule extends ConsoleSectionRule {
        @Override
        public String getId() {
            return "maven-phase";
        }

        @Override
        public String getDisplayName() {
            return "Maven Phase";
        }

        @Override
        public String getStartPattern() {
            return "^\\[INFO\\] --- (.+) ---$";
        }

        @Override
        public String getEndPattern() {
            return "^\\[INFO\\] --- .+ ---|^\\[INFO\\] -+$";
        }
    }

    @Extension
    public static class GradleTaskRule extends ConsoleSectionRule {
        @Override
        public String getId() {
            return "gradle-task";
        }

        @Override
        public String getDisplayName() {
            return "Gradle Task";
        }

        @Override
        public String getStartPattern() {
            return "^> Task (:.+)$";
        }

        @Override
        public String getEndPattern() {
            return "^> Task :.+|^BUILD ";
        }
    }

    @Extension
    public static class NpmScriptRule extends ConsoleSectionRule {
        @Override
        public String getId() {
            return "npm-script";
        }

        @Override
        public String getDisplayName() {
            return "npm Script";
        }

        @Override
        public String getStartPattern() {
            return "^> (.+)$";
        }

        @Override
        public String getEndPattern() {
            return "^> .+|^npm warn|^npm error";
        }

        @Override
        public boolean isEnabledByDefault() {
            // npm output is less uniform; opt-in by default.
            return false;
        }
    }

    @Extension
    public static class DockerPullRule extends ConsoleSectionRule {
        @Override
        public String getId() {
            return "docker-pull";
        }

        @Override
        public String getDisplayName() {
            return "Docker Pull";
        }

        @Override
        public String getStartPattern() {
            return "^(?:Pulling from|Pulling image) (.+)";
        }

        @Override
        public String getEndPattern() {
            return "^(?:Digest: |Status: )";
        }
    }

    @Extension
    public static class TerraformPlanRule extends ConsoleSectionRule {
        @Override
        public String getId() {
            return "terraform-plan";
        }

        @Override
        public String getDisplayName() {
            return "Terraform Plan";
        }

        @Override
        public String getStartPattern() {
            return "^Terraform will perform the following actions:";
        }

        @Override
        public String getEndPattern() {
            return "^Plan: ";
        }
    }
}
