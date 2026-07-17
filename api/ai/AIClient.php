<?php
/**
 * AI 客户端统一接口
 * 所有 AI 平台（Deepseek/豆包等）实现此接口，
 * 业务层通过 AIFactory 创建实例，不关心底层差异。
 */
interface AIClient
{
    /**
     * 处理文档内容
     *
     * @param string $documentText      文档正文文本
     * @param string $formatRequirements 格式要求（来自用户上传的模板或粘贴文本）
     * @param string $serviceType       服务类型：format/proofread/process
     * @return array [
     *     'summary'   => string,                  // 总体结论
     *     'issues'    => [                         // 问题列表
     *         ['page'=>null,'line'=>null,'issue_type'=>'','description'=>'','suggestion'=>'','original_text'=>'','revised_text'=>'','status'=>'suggested'],
     *         ...
     *     ],
     *     'revised_text' => string|null,           // 加工类服务返回完整修改后文本
     * ]
     */
    public function processDocument($documentText, $formatRequirements, $serviceType);

    /**
     * 返回提供商标识
     */
    public function getProviderName();

    /**
     * 返回模型名
     */
    public function getModelName();
}
