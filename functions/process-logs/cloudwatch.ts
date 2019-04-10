import { CloudWatch } from 'aws-sdk'
import { chunk as chunkArray } from 'lodash'
import { MetricDatum, PutMetricDataInput } from 'aws-sdk/clients/cloudwatch';

const client = new CloudWatch()

const publish = async (metricDatum, namespace) => {
  let metricData = metricDatum.map(m => {
    return {
      MetricName: m.MetricName,
      Dimensions: m.Dimensions,
      Timestamp: m.Timestamp,
      Unit: m.Unit,
      Value: m.Value,
    }
  })

  // cloudwatch only allows 20 metrics per request
  let chunks: MetricDatum[][] = chunkArray(metricData, 20)

  for (const chunk of chunks) {
    let req: PutMetricDataInput = {
      MetricData: chunk,
      Namespace: namespace,
    }

    await client.putMetricData(req).promise()
  }
}

export default { publish }
