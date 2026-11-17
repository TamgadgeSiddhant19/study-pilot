import { SheetProblem } from "./dsaSheets";

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface ProblemFullDetails {
  description: string;
  examples: ProblemExample[];
  constraints: string[];
  starterCode: {
    python: string;
    cpp: string;
    java: string;
  };
}

export const CURATED_PROBLEM_DETAILS: Record<number, ProblemFullDetails> = {
  // ================= 242. Valid Anagram =================
  242: {
    description: `Given two strings s and t, return true if the two strings are anagrams of each other, otherwise return false.

Two strings are anagrams if they contain the same characters, with each character appearing the same number of times, regardless of order.`,
    examples: [
      {
        input: 's = "racecar", t = "carrace"',
        output: "true",
        explanation: 'Both strings have the exact same character counts: 2 r\'s, 2 a\'s, 2 c\'s, 1 e.',
      },
      {
        input: 's = "jar", t = "jam"',
        output: "false",
        explanation: 'The strings have different characters.',
      },
    ],
    constraints: [
      "1 <= s.length, t.length <= 5 * 10^4",
      "s and t consist of lowercase English letters.",
    ],
    starterCode: {
      python: `class Solution:
    def isAnagram(self, s: str, t: str) -> bool:
        # Write your solution here
        if len(s) != len(t):
            return False
        
        count = {}
        for c in s:
            count[c] = count.get(c, 0) + 1
        for c in t:
            if c not in count or count[c] == 0:
                return False
            count[c] -= 1
        return True

# Local Test Execution
if __name__ == "__main__":
    sol = Solution()
    print("Example 1 Output:", sol.isAnagram("racecar", "carrace")) # Expected: True
    print("Example 2 Output:", sol.isAnagram("jar", "jam"))         # Expected: False
`,
      java: `import java.util.*;

public class Main {
    public static boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        int[] count = new int[26];
        for (int i = 0; i < s.length(); i++) {
            count[s.charAt(i) - 'a']++;
            count[t.charAt(i) - 'a']--;
        }
        for (int c : count) {
            if (c != 0) return false;
        }
        return true;
    }

    public static void main(String[] args) {
        System.out.println("Example 1: " + isAnagram("racecar", "carrace")); // Expected: true
        System.out.println("Example 2: " + isAnagram("jar", "jam"));         // Expected: false
    }
}
`,
      cpp: `#include <iostream>
#include <string>
#include <vector>

using namespace std;

class Solution {
public:
    bool isAnagram(string s, string t) {
        if (s.length() != t.length()) return false;
        vector<int> count(26, 0);
        for (char c : s) count[c - 'a']++;
        for (char c : t) {
            if (--count[c - 'a'] < 0) return false;
        }
        return true;
    }
};

int main() {
    Solution sol;
    cout << boolalpha;
    cout << "Example 1: " << sol.isAnagram("racecar", "carrace") << endl; // Expected: true
    cout << "Example 2: " << sol.isAnagram("jar", "jam") << endl;         // Expected: false
    return 0;
}
`,
    },
  },

  // ================= 217. Contains Duplicate =================
  217: {
    description: `Given an integer array nums, return true if any value appears at least twice in the array, and return false if every element is distinct.`,
    examples: [
      {
        input: "nums = [1, 2, 3, 1]",
        output: "true",
        explanation: "1 appears at index 0 and 3.",
      },
      {
        input: "nums = [1, 2, 3, 4]",
        output: "false",
        explanation: "All elements are distinct.",
      },
      {
        input: "nums = [1, 1, 1, 3, 3, 4, 3, 2, 4, 2]",
        output: "true",
      },
    ],
    constraints: [
      "1 <= nums.length <= 10^5",
      "-10^9 <= nums[i] <= 10^9",
    ],
    starterCode: {
      python: `from typing import List

class Solution:
    def containsDuplicate(self, nums: List[int]) -> bool:
        # Write your solution here
        seen = set()
        for x in nums:
            if x in seen:
                return True
            seen.add(x)
        return False

# Local Test Execution
if __name__ == "__main__":
    sol = Solution()
    print("Example 1:", sol.containsDuplicate([1, 2, 3, 1])) # Expected: True
    print("Example 2:", sol.containsDuplicate([1, 2, 3, 4])) # Expected: False
`,
      java: `import java.util.*;

public class Main {
    public static boolean containsDuplicate(int[] nums) {
        Set<Integer> seen = new HashSet<>();
        for (int num : nums) {
            if (!seen.add(num)) return true;
        }
        return false;
    }

    public static void main(String[] args) {
        System.out.println("Example 1: " + containsDuplicate(new int[]{1, 2, 3, 1})); // Expected: true
        System.out.println("Example 2: " + containsDuplicate(new int[]{1, 2, 3, 4})); // Expected: false
    }
}
`,
      cpp: `#include <iostream>
#include <vector>
#include <unordered_set>

using namespace std;

class Solution {
public:
    bool containsDuplicate(vector<int>& nums) {
        unordered_set<int> seen;
        for (int x : nums) {
            if (seen.count(x)) return true;
            seen.insert(x);
        }
        return false;
    }
};

int main() {
    Solution sol;
    vector<int> test1 = {1, 2, 3, 1};
    vector<int> test2 = {1, 2, 3, 4};
    cout << boolalpha;
    cout << "Example 1: " << sol.containsDuplicate(test1) << endl; // Expected: true
    cout << "Example 2: " << sol.containsDuplicate(test2) << endl; // Expected: false
    return 0;
}
`,
    },
  },

  // ================= 1. Two Sum =================
  1: {
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.`,
    examples: [
      {
        input: "nums = [2, 7, 11, 15], target = 9",
        output: "[0, 1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
      {
        input: "nums = [3, 2, 4], target = 6",
        output: "[1, 2]",
      },
      {
        input: "nums = [3, 3], target = 6",
        output: "[0, 1]",
      },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists.",
    ],
    starterCode: {
      python: `from typing import List

class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        # Write your solution here
        seen = {}
        for i, val in enumerate(nums):
            complement = target - val
            if complement in seen:
                return [seen[complement], i]
            seen[val] = i
        return []

# Local Test Execution
if __name__ == "__main__":
    sol = Solution()
    print("Example 1:", sol.twoSum([2, 7, 11, 15], 9)) # Expected: [0, 1]
    print("Example 2:", sol.twoSum([3, 2, 4], 6))       # Expected: [1, 2]
`,
      java: `import java.util.*;

public class Main {
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int comp = target - nums[i];
            if (map.containsKey(comp)) {
                return new int[]{map.get(comp), i};
            }
            map.put(nums[i], i);
        }
        return new int[]{};
    }

    public static void main(String[] args) {
        int[] res1 = twoSum(new int[]{2, 7, 11, 15}, 9);
        System.out.println("Example 1: " + Arrays.toString(res1)); // Expected: [0, 1]
    }
}
`,
      cpp: `#include <iostream>
#include <vector>
#include <unordered_map>

using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < nums.size(); i++) {
            int comp = target - nums[i];
            if (seen.find(comp) != seen.end()) {
                return {seen[comp], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};

int main() {
    Solution sol;
    vector<int> nums = {2, 7, 11, 15};
    vector<int> res = sol.twoSum(nums, 9);
    cout << "Example 1: [" << res[0] << ", " << res[1] << "]" << endl;
    return 0;
}
`,
    },
  },

  // ================= 49. Group Anagrams =================
  49: {
    description: `Given an array of strings strs, group the anagrams together. You can return the answer in any order.

An Anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.`,
    examples: [
      {
        input: 'strs = ["eat", "tea", "tan", "ate", "nat", "bat"]',
        output: '[["bat"], ["nat", "tan"], ["ate", "eat", "tea"]]',
      },
      {
        input: 'strs = [""]',
        output: '[[""]]',
      },
      {
        input: 'strs = ["a"]',
        output: '[["a"]]',
      },
    ],
    constraints: [
      "1 <= strs.length <= 10^4",
      "0 <= strs[i].length <= 100",
      "strs[i] consists of lowercase English letters.",
    ],
    starterCode: {
      python: `from typing import List
from collections import defaultdict

class Solution:
    def groupAnagrams(self, strs: List[str]) -> List[List[str]]:
        # Write your solution here
        groups = defaultdict(list)
        for s in strs:
            key = "".join(sorted(s))
            groups[key].append(s)
        return list(groups.values())

# Local Test Execution
if __name__ == "__main__":
    sol = Solution()
    print("Example 1:", sol.groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"]))
`,
      java: `import java.util.*;

public class Main {
    public static List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> map = new HashMap<>();
        for (String s : strs) {
            char[] ca = s.toCharArray();
            Arrays.sort(ca);
            String key = String.valueOf(ca);
            map.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }
        return new ArrayList<>(map.values());
    }

    public static void main(String[] args) {
        String[] strs = {"eat", "tea", "tan", "ate", "nat", "bat"};
        System.out.println("Example 1: " + groupAnagrams(strs));
    }
}
`,
      cpp: `#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <algorithm>

using namespace std;

class Solution {
public:
    vector<vector<string>> groupAnagrams(vector<string>& strs) {
        unordered_map<string, vector<string>> map;
        for (string s : strs) {
            string key = s;
            sort(key.begin(), key.end());
            map[key].push_back(s);
        }
        vector<vector<string>> res;
        for (auto& p : map) res.push_back(p.second);
        return res;
    }
};

int main() {
    Solution sol;
    vector<string> strs = {"eat", "tea", "tan", "ate", "nat", "bat"};
    auto res = sol.groupAnagrams(strs);
    cout << "Groups count: " << res.size() << endl;
    return 0;
}
`,
    },
  },

  // ================= 125. Valid Palindrome =================
  125: {
    description: `A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string s, return true if it is a palindrome, or false otherwise.`,
    examples: [
      {
        input: 's = "A man, a plan, a canal: Panama"',
        output: "true",
        explanation: '"amanaplanacanalpanama" is a palindrome.',
      },
      {
        input: 's = "race a car"',
        output: "false",
        explanation: '"raceacar" is not a palindrome.',
      },
      {
        input: 's = " "',
        output: "true",
        explanation: 's is an empty string "" after removing non-alphanumeric characters, which is a palindrome.',
      },
    ],
    constraints: [
      "1 <= s.length <= 2 * 10^5",
      "s consists only of printable ASCII characters.",
    ],
    starterCode: {
      python: `class Solution:
    def isPalindrome(self, s: str) -> bool:
        # Two pointer approach
        l, r = 0, len(s) - 1
        while l < r:
            while l < r and not s[l].isalnum():
                l += 1
            while l < r and not s[r].isalnum():
                r -= 1
            if s[l].lower() != s[r].lower():
                return False
            l += 1
            r -= 1
        return True

if __name__ == "__main__":
    sol = Solution()
    print("Example 1:", sol.isPalindrome("A man, a plan, a canal: Panama")) # True
    print("Example 2:", sol.isPalindrome("race a car"))                     # False
`,
      java: `public class Main {
    public static boolean isPalindrome(String s) {
        int l = 0, r = s.length() - 1;
        while (l < r) {
            while (l < r && !Character.isLetterOrDigit(s.charAt(l))) l++;
            while (l < r && !Character.isLetterOrDigit(s.charAt(r))) r--;
            if (Character.toLowerCase(s.charAt(l)) != Character.toLowerCase(s.charAt(r))) {
                return false;
            }
            l++;
            r--;
        }
        return true;
    }

    public static void main(String[] args) {
        System.out.println("Example 1: " + isPalindrome("A man, a plan, a canal: Panama"));
    }
}
`,
      cpp: `#include <iostream>
#include <string>
#include <cctype>

using namespace std;

class Solution {
public:
    bool isPalindrome(string s) {
        int l = 0, r = s.length() - 1;
        while (l < r) {
            while (l < r && !isalnum(s[l])) l++;
            while (l < r && !isalnum(s[r])) r--;
            if (tolower(s[l]) != tolower(s[r])) return false;
            l++;
            r--;
        }
        return true;
    }
};

int main() {
    Solution sol;
    cout << boolalpha << sol.isPalindrome("A man, a plan, a canal: Panama") << endl;
    return 0;
}
`,
    },
  },
};

/**
 * Helper to return complete problem specifications, falling back to clean generated
 * structures for any problem in the sheet catalog.
 */
export function getProblemFullDetails(prob: SheetProblem): ProblemFullDetails {
  if (CURATED_PROBLEM_DETAILS[prob.id]) {
    return CURATED_PROBLEM_DETAILS[prob.id];
  }

  // Fallback template for all other curated problems
  return {
    description: `Solve the problem: "${prob.title}".

Pattern: ${prob.pattern} (${prob.category})
Optimal Complexity Target: Time ${prob.timeComplexity}, Space ${prob.spaceComplexity}.

Analyze the constraints and implement the most optimal algorithmic approach.`,
    examples: [
      {
        input: `Sample test input for ${prob.title}`,
        output: `Expected optimal output`,
        explanation: `Algorithm achieves target ${prob.timeComplexity} complexity using ${prob.pattern}.`,
      },
    ],
    constraints: [
      `Time Complexity Target: ${prob.timeComplexity}`,
      `Space Complexity Target: ${prob.spaceComplexity}`,
      `Category: ${prob.category}`,
    ],
    starterCode: {
      python: `# ==============================================================
# Problem: #${prob.id} - ${prob.title}
# Difficulty: ${prob.difficulty} | Pattern: ${prob.pattern}
# Target Time: ${prob.timeComplexity} | Space: ${prob.spaceComplexity}
# Hint: ${prob.hint}
# ==============================================================

class Solution:
    def solve(self):
        # Write your solution here
        print("Executing solution for: ${prob.title}")

if __name__ == "__main__":
    sol = Solution()
    sol.solve()
`,
      java: `// ==============================================================
// Problem: #${prob.id} - ${prob.title}
// Difficulty: ${prob.difficulty} | Pattern: ${prob.pattern}
// Target Time: ${prob.timeComplexity} | Space: ${prob.spaceComplexity}
// ==============================================================
import java.util.*;

public class Main {
    public static void main(String[] args) {
        System.out.println("Executing solution for: ${prob.title} (LeetCode #${prob.id})");
    }
}
`,
      cpp: `// ==============================================================
// Problem: #${prob.id} - ${prob.title}
// Difficulty: ${prob.difficulty} | Pattern: ${prob.pattern}
// Target Time: ${prob.timeComplexity} | Space: ${prob.spaceComplexity}
// ==============================================================
#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>

using namespace std;

class Solution {
public:
    void solve() {
        cout << "Executing solution for: ${prob.title} (LeetCode #${prob.id})" << endl;
    }
};

int main() {
    Solution sol;
    sol.solve();
    return 0;
}
`,
    },
  };
}

