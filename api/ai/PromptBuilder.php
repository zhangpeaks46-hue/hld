<?php
/**
 * AI 调用提示词构建器
 * 根据服务类型与格式要求，构造发送给大模型的系统提示与用户提示。
 */
class PromptBuilder
{
    /**
     * 构造提示词
     *
     * @param string $serviceType  format/proofread/process
     * @param string $docText      文档正文
     * @param string $formatReq    格式要求
     * @return array ['system' => string, 'user' => string]
     */
    public static function build($serviceType, $docText, $formatReq)
    {
        $formatReq = trim($formatReq ?: '按通用学术论文格式规范处理');

        switch ($serviceType) {
            case 'format':
                return self::buildFormat($docText, $formatReq);
            case 'proofread':
                return self::buildProofread($docText, $formatReq);
            case 'process':
                return self::buildProcess($docText, $formatReq);
            default:
                return self::buildFormat($docText, $formatReq);
        }
    }

    /**
     * 格式检测
     */
    private static function buildFormat($docText, $formatReq)
    {
        $system = "你是一位严谨的学术论文格式审核专家。"
            . "你的任务是根据用户给出的格式要求，逐条检查文档中的格式问题，"
            . "包括但不限于：字体、字号、行距、页边距、标题层级、参考文献、图表编号、页码、目录等。"
            . "请严格按照 JSON 格式输出结果，不要输出任何额外解释文字。";

        $user = "【格式要求】\n" . $formatReq . "\n\n"
            . "【待检测文档内容】\n" . $docText . "\n\n"
            . "请按以下 JSON 结构输出：\n"
            . "{\n"
            . "  \"summary\": \"总体格式评估结论\",\n"
            . "  \"issues\": [\n"
            . "    {\n"
            . "      \"page\": 页码或null,\n"
            . "      \"line\": 行号或null,\n"
            . "      \"issue_type\": \"问题类型如字体不统一/行距错误\",\n"
            . "      \"description\": \"问题描述\",\n"
            . "      \"suggestion\": \"修改建议\",\n"
            . "      \"original_text\": \"原文片段\",\n"
            . "      \"revised_text\": \"修改后片段\",\n"
            . "      \"status\": \"fixed|manual|suggested\"\n"
            . "    }\n"
            . "  ]\n"
            . "}";
        return ['system' => $system, 'user' => $user];
    }

    /**
     * 文字校对
     */
    private static function buildProofread($docText, $formatReq)
    {
        $system = "你是一位专业的文字校对编辑。"
            . "请检测文档中的错别字、多音字、形近字、语法错误、语义不通顺、逻辑矛盾，"
            . "以及低俗、暴力、敏感、违规内容，并给出修正建议。"
            . "请严格按照 JSON 格式输出，不要输出额外解释文字。";

        $user = "【校对要求】\n" . $formatReq . "\n\n"
            . "【待校对文档内容】\n" . $docText . "\n\n"
            . "请按以下 JSON 结构输出：\n"
            . "{\n"
            . "  \"summary\": \"总体校对结论\",\n"
            . "  \"issues\": [\n"
            . "    {\n"
            . "      \"page\": null,\n"
            . "      \"line\": 行号或null,\n"
            . "      \"issue_type\": \"错别字/语法/语义/合规\",\n"
            . "      \"description\": \"问题描述\",\n"
            . "      \"suggestion\": \"修正建议\",\n"
            . "      \"original_text\": \"原文片段\",\n"
            . "      \"revised_text\": \"修正后片段\",\n"
            . "      \"status\": \"suggested\"\n"
            . "    }\n"
            . "  ]\n"
            . "}";
        return ['system' => $system, 'user' => $user];
    }

    /**
     * 文字加工（降重/优化表达）
     */
    private static function buildProcess($docText, $formatReq)
    {
        $system = "你是一位学术写作润色专家。"
            . "请按用户要求改写文档：降低重复率、调整语言风格、弱化 AI 痕迹、优化逻辑表达，"
            . "同时保持学术严谨性和原意不变。"
            . "请严格按照 JSON 格式输出，不要输出额外解释文字。";

        $user = "【加工要求】\n" . $formatReq . "\n\n"
            . "【待加工文档内容】\n" . $docText . "\n\n"
            . "请按以下 JSON 结构输出：\n"
            . "{\n"
            . "  \"summary\": \"总体加工说明\",\n"
            . "  \"revised_text\": \"完整的加工后全文\",\n"
            . "  \"issues\": [\n"
            . "    {\n"
            . "      \"page\": null,\n"
            . "      \"line\": null,\n"
            . "      \"issue_type\": \"改写/降重/风格调整\",\n"
            . "      \"description\": \"改动说明\",\n"
            . "      \"suggestion\": \"\",\n"
            . "      \"original_text\": \"原句\",\n"
            . "      \"revised_text\": \"改写后句子\",\n"
            . "      \"status\": \"fixed\"\n"
            . "    }\n"
            . "  ]\n"
            . "}";
        return ['system' => $system, 'user' => $user];
    }
}
