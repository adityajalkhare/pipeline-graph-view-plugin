package io.jenkins.plugins.pipelinegraphview.consoleview;

import edu.umd.cs.findbugs.annotations.CheckForNull;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Processes console log text through registered {@link ConsoleSectionAnnotator}
 * instances and collects section boundary events.
 *
 * <p>Annotator instances may be shared singletons (e.g. from
 * {@code ExtensionList}). All access to annotator state ({@code reset()},
 * {@code detect()}) is synchronized so concurrent requests are safe.
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

        String[] lines = logText.split("\n", -1);
        List<BoundaryEvent> events = new ArrayList<>();

        synchronized (this) {
            for (ConsoleSectionAnnotator a : annotators) {
                a.reset();
            }

            for (int i = 0; i < lines.length; i++) {
                String line = lines[i];
                for (ConsoleSectionAnnotator annotator : annotators) {
                    ConsoleSectionAnnotator.SectionBoundary boundary = annotator.detect(line);
                    if (boundary.getType() != ConsoleSectionAnnotator.SectionBoundary.Type.NONE) {
                        events.add(new BoundaryEvent(
                                i,
                                boundary.getType() == ConsoleSectionAnnotator.SectionBoundary.Type.START
                                        ? "START"
                                        : "END",
                                boundary.getTitle()));
                        break;
                    }
                }
            }
        }

        return events;
    }

    /**
     * Process log content from an input stream, reading line by line to avoid
     * buffering the entire log as a single String.
     *
     * @param input stream of raw plain-text log output (UTF-8)
     * @return ordered list of boundary events with line indices
     */
    public List<BoundaryEvent> process(InputStream input) throws IOException {
        if (annotators.isEmpty()) {
            return Collections.emptyList();
        }

        List<BoundaryEvent> events = new ArrayList<>();
        synchronized (this) {
            for (ConsoleSectionAnnotator a : annotators) {
                a.reset();
            }

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
                String line;
                int lineIndex = 0;
                while ((line = reader.readLine()) != null) {
                    for (ConsoleSectionAnnotator annotator : annotators) {
                        ConsoleSectionAnnotator.SectionBoundary boundary = annotator.detect(line);
                        if (boundary.getType() != ConsoleSectionAnnotator.SectionBoundary.Type.NONE) {
                            events.add(new BoundaryEvent(
                                    lineIndex,
                                    boundary.getType() == ConsoleSectionAnnotator.SectionBoundary.Type.START
                                            ? "START"
                                            : "END",
                                    boundary.getTitle()));
                            break;
                        }
                    }
                    lineIndex++;
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
