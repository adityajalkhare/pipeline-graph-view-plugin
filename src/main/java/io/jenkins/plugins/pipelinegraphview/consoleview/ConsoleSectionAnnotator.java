package io.jenkins.plugins.pipelinegraphview.consoleview;

import edu.umd.cs.findbugs.annotations.CheckForNull;
import hudson.ExtensionList;
import hudson.ExtensionPoint;

/**
 * Extension point for stateful console section detection.
 *
 * <p>Unlike {@link ConsoleSectionRule} which uses simple regex pairs,
 * this extension allows stateful, line-by-line analysis for richer
 * section detection (multi-line pattern matching, context-dependent
 * titles, dynamic enable/disable conditions).
 *
 * <p>Implementations receive lines one at a time via {@link #detect(String)}
 * and return section boundary events. State is maintained per annotator
 * instance; a fresh instance is created for each log stream.
 *
 * <p>Example:
 * <pre>
 * {@literal @}Extension
 * public class StackTraceAnnotator extends ConsoleSectionAnnotator {
 *     private boolean inTrace = false;
 *
 *     {@literal @}Override public String getId() { return "stack-trace"; }
 *     {@literal @}Override public String getDisplayName() { return "Stack Trace"; }
 *
 *     {@literal @}Override
 *     public SectionBoundary detect(String line) {
 *         if (!inTrace &amp;&amp; line.matches(".*Exception.*")) {
 *             inTrace = true;
 *             return SectionBoundary.start(line.trim());
 *         }
 *         if (inTrace &amp;&amp; !line.startsWith("\tat ") &amp;&amp; !line.startsWith("Caused by:")) {
 *             inTrace = false;
 *             return SectionBoundary.END;
 *         }
 *         return SectionBoundary.NONE;
 *     }
 * }
 * </pre>
 */
public abstract class ConsoleSectionAnnotator implements ExtensionPoint {

    /**
     * Unique identifier for this annotator.
     */
    public abstract String getId();

    /**
     * Human-readable name for the settings panel.
     */
    public abstract String getDisplayName();

    /**
     * Whether this annotator is enabled by default.
     */
    public boolean isEnabledByDefault() {
        return true;
    }

    /**
     * Analyze a single line and return a section boundary event.
     *
     * <p>Called once per line, in order. The annotator may maintain
     * internal state across calls within a single log stream.
     *
     * @param line the raw console output line (may contain ANSI escapes)
     * @return a boundary event, or {@link SectionBoundary#NONE} if no transition
     */
    @CheckForNull
    public abstract SectionBoundary detect(String line);

    /**
     * Reset internal state. Called before processing a new log stream.
     */
    public void reset() {
        // Default no-op; subclasses override as needed.
    }

    /**
     * All registered annotators.
     */
    public static ExtensionList<ConsoleSectionAnnotator> all() {
        return ExtensionList.lookup(ConsoleSectionAnnotator.class);
    }

    /**
     * Represents a section boundary event returned by {@link #detect(String)}.
     */
    public static final class SectionBoundary {
        /** No section transition on this line. */
        public static final SectionBoundary NONE = new SectionBoundary(Type.NONE, null);

        /** Close the current section. */
        public static final SectionBoundary END = new SectionBoundary(Type.END, null);

        private final Type type;
        private final String title;

        private SectionBoundary(Type type, String title) {
            this.type = type;
            this.title = title;
        }

        /** Open a new section with the given title. */
        public static SectionBoundary start(String title) {
            return new SectionBoundary(Type.START, title);
        }

        public Type getType() {
            return type;
        }

        @CheckForNull
        public String getTitle() {
            return title;
        }

        public enum Type {
            NONE,
            START,
            END
        }
    }
}
