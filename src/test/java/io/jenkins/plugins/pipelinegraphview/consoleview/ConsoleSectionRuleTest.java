package io.jenkins.plugins.pipelinegraphview.consoleview;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;

import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

@WithJenkins
class ConsoleSectionRuleTest {

    @Test
    void builtInRulesAreDiscovered(JenkinsRule j) {
        List<ConsoleSectionRule> rules =
                ConsoleSectionRule.all().stream().toList();
        assertThat(rules.size(), greaterThanOrEqualTo(5));

        List<String> ids = rules.stream().map(ConsoleSectionRule::getId).toList();
        assertThat(ids, hasItem("maven-phase"));
        assertThat(ids, hasItem("gradle-task"));
        assertThat(ids, hasItem("npm-script"));
        assertThat(ids, hasItem("docker-pull"));
        assertThat(ids, hasItem("terraform-plan"));
    }

    @Test
    void eachRuleHasValidPatterns(JenkinsRule j) {
        for (ConsoleSectionRule rule : ConsoleSectionRule.all()) {
            assertThat(rule.getId(), not(emptyOrNullString()));
            assertThat(rule.getDisplayName(), not(emptyOrNullString()));
            // Verify patterns compile without error.
            Pattern.compile(rule.getStartPattern());
            Pattern.compile(rule.getEndPattern());
        }
    }

    @Test
    void mavenPhaseRuleMatchesExpectedOutput(JenkinsRule j) {
        ConsoleSectionRule maven = ConsoleSectionRule.all().stream()
                .filter(r -> "maven-phase".equals(r.getId()))
                .findFirst()
                .orElseThrow();
        Pattern start = Pattern.compile(maven.getStartPattern());
        Pattern end = Pattern.compile(maven.getEndPattern());

        assertThat(start.matcher("[INFO] --- maven-compiler-plugin:3.8.1:compile (default) ---").matches(), is(true));
        assertThat(start.matcher("[INFO] Compiling 5 source files").matches(), is(false));
        assertThat(end.matcher("[INFO] --- maven-surefire-plugin:2.22:test ---").find(), is(true));
        assertThat(end.matcher("[INFO] -------------------------").find(), is(true));
    }

    @Test
    void gradleTaskRuleMatchesExpectedOutput(JenkinsRule j) {
        ConsoleSectionRule gradle = ConsoleSectionRule.all().stream()
                .filter(r -> "gradle-task".equals(r.getId()))
                .findFirst()
                .orElseThrow();
        Pattern start = Pattern.compile(gradle.getStartPattern());

        assertThat(start.matcher("> Task :compileJava").matches(), is(true));
        assertThat(start.matcher("> Task :test").matches(), is(true));
        assertThat(start.matcher("some other output").matches(), is(false));
    }

    @Test
    void dockerPullRuleMatchesExpectedOutput(JenkinsRule j) {
        ConsoleSectionRule docker = ConsoleSectionRule.all().stream()
                .filter(r -> "docker-pull".equals(r.getId()))
                .findFirst()
                .orElseThrow();
        Pattern start = Pattern.compile(docker.getStartPattern());
        Pattern end = Pattern.compile(docker.getEndPattern());

        assertThat(start.matcher("Pulling from library/node").find(), is(true));
        assertThat(start.matcher("Pulling image docker.io/library/maven:3.8").find(), is(true));
        assertThat(end.matcher("Digest: sha256:abc123").find(), is(true));
        assertThat(end.matcher("Status: Downloaded newer image").find(), is(true));
    }

    @Test
    void npmScriptRuleIsDisabledByDefault(JenkinsRule j) {
        ConsoleSectionRule npm = ConsoleSectionRule.all().stream()
                .filter(r -> "npm-script".equals(r.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(npm.isEnabledByDefault(), is(false));
    }

    @Test
    void terraformPlanRuleMatchesExpectedOutput(JenkinsRule j) {
        ConsoleSectionRule tf = ConsoleSectionRule.all().stream()
                .filter(r -> "terraform-plan".equals(r.getId()))
                .findFirst()
                .orElseThrow();
        Pattern start = Pattern.compile(tf.getStartPattern());
        Pattern end = Pattern.compile(tf.getEndPattern());

        assertThat(start.matcher("Terraform will perform the following actions:").find(), is(true));
        assertThat(end.matcher("Plan: 3 to add, 1 to change, 0 to destroy.").find(), is(true));
    }
}
