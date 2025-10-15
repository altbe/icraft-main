#!/bin/bash
# Stories needing LLM processing (remaining after manual fixes)
#
# Priority 1: Stories with 0 pages (need full parsing)
# Priority 2: Stories with pages but missing tags

cat <<EOF
Stories with 0 pages (need full processing):
- chuck-e-cheese-story (has 3 tags already)
- fire-drill-story
- going-to-grocery-store-story
- iep-story
- jaydens-basketball-lesson (has 5 tags already)
- military-base
- not-fair-social-story
- quiet-voice-story
- saying-hello-story
- spanish-story-1
- squirrel-story
- staying-calm-upset-story
- story-about-autism
- strangers-story
- sub-teacher-story
- technology-story
- transitioning-car-to-school-story
- using-polite-language-story
- when-my-parent-deploys-story

Stories with pages but missing tags (need tags only):
- adult-train-ride-story
- adults-help-children-fix-mistakes
- asking-for-help-story
- break-card-story
- don-t-eat-from-garbage-can-story
- falling-asleep-story
- fc-moving-into-new-home
- fc-moving-to-new-home-girl
- getting-a-new-brother-or-sister-story
- halloween-social-story
- having-fun-playground-story
- joining-other-kids-story
- lone-leader-story
- money-story
- please-thank-you-story
- riding-bike-story
- saying-goodbye-story
- saying-no-story
- school-pictures-story
- standing-up-for-myself-story
- swimming-social-story
- taking-a-break-story
- therapist-autism-story
- throwing-toys-story
- using-an-elevator
- want-a-hug-story
- zoo-story
EOF
