package io.jenkins.plugins.pipelinegraphview.consoleview;

import edu.umd.cs.findbugs.annotations.CheckForNull;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Processes console log text through registered {@link ConsoleSectionAnnotator}
 * instances and collects section boundary events.
 */
public class ConsoleSectionProcessor {

    private final List<ConsoleSectionAnnotator> annotators;

    public ConsoleSectionProcessor(List<ConsoleSectionAnnotator> annotators) {
        // Filter to only enabled annotators.
        List<ConsoleSectionAnnotator> enabled = new ArrayList<>();
        for (ConsoleSectionAnnotator a : annotators) {
            if (a.isEnabledByDefault()) {
                enabled.add(a);
            }
        }
        this.annotators = Collections.unmodifiableList(enabled);
    }

    /**
     * Process raw log text and return boundary events.
     *
     * @param logText raw plain-text log output (not HTML)
     * @return ordered list of boundary events with line indices
     */
    public List<BoundaryEvent> process(String logText) {
        if (annotators.isEmpty() || logText.isEmpty()) {
            return Collections.emptyList();
        }

        for (ConsoleSectionAnnotator a : annotators) {
            a.reset();
        }

        String[] lines = logText.split("\n", -1);
        List<BoundaryEvent> events = new ArrayList<>();

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            for (ConsoleSectionAnnotator annotator : annotators) {
                ConsoleSectionAnnotator.SectionBoundary boundary = annotator.detect(line);
                if (boundary.getType() != ConsoleSectionAnnotator.SectionBoundary.Type.NONE) {
                    events.add(new BoundaryEvent(
                            i,
                            boundary.getType() == ConsoleSectionAnnotator.SectionBoundary.Type.START ? "START" : "END",
                            boundary.getTitle()));
                    // First annotator to match wins for this line.
                    break;
                }
            }
        }

        return events;
    }

    /**
     * A single section boundary event at a specific line index.
     */
    public static final class BoundaryEvent {
        private final int lineIndex;
        private final String type;
        private final String title;

        public BoundaryEvent(int lineIndex, String type, @CheckForNull String title) {
            this.lineIndex = lineIndex;
            this.type = type;
            this.title = title;
        }

        public int getLineIndex() {
            return lineIndex;
        }

        /** "START" or "END". */
        public String getType() {
            return type;
        }

        @CheckForNull
        public String getTitle() {
            return title;
        }
    }
}
